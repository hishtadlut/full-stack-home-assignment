import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const cwd = process.cwd();
const repoRoot = path.resolve(cwd, '..');
const host = process.env.VISUAL_HOST || '127.0.0.1';
const port = Number(process.env.VISUAL_PORT || 5174);
const baseUrl = `http://${host}:${port}`;
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(repoRoot, 'output', 'playwright');
const runDir = path.join(outputRoot, runId);
const baselineDir = resolveOptionalPath(readOption('baseline') || process.env.VISUAL_BASELINE_DIR);
const updateBaselineDir = resolveOptionalPath(readOption('update-baseline') || process.env.VISUAL_UPDATE_BASELINE_DIR);
const allowedPixels = Number(process.env.VISUAL_ALLOWED_PIXELS || 150);

const user = {
  id: 'user-1',
  email: 'qa@example.com',
  username: 'qa',
  name: 'QA Reviewer',
};

const tasks = [
  {
    id: 'task-1',
    title: 'Finalize assistant review flow',
    description: 'Review editable drafts, apply approved changes, and capture screenshots.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    userId: user.id,
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-03T10:30:00.000Z',
    user,
    assignments: [{ id: 'assignment-1', taskId: 'task-1', userId: user.id, user }],
  },
  {
    id: 'task-2',
    title: 'Write API coverage notes',
    description: 'Document route validation and error handling gaps.',
    status: 'TODO',
    priority: 'MEDIUM',
    userId: user.id,
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-05-02T09:30:00.000Z',
    user,
    assignments: [],
  },
  {
    id: 'task-3',
    title: 'Ship dashboard filters',
    description: 'URL-backed search, status, and priority filters.',
    status: 'DONE',
    priority: 'LOW',
    userId: user.id,
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-05-01T15:00:00.000Z',
    user,
    assignments: [],
  },
];

const comments = [
  {
    id: 'comment-1',
    taskId: 'task-1',
    userId: user.id,
    content: 'Design review is ready. Confirm the destructive actions stay behind draft approval.',
    createdAt: '2026-05-03T11:00:00.000Z',
    updatedAt: '2026-05-03T11:00:00.000Z',
    user,
  },
];

const draft = {
  schemaVersion: 1,
  summary: 'Create the QA follow-up task',
  operations: [
    {
      id: 'create_task',
      type: 'create_task',
      label: 'Create task',
      input: {
        title: 'Prepare UI regression notes',
        description: 'Capture dashboard, detail, and assistant flows before merge.',
        status: 'TODO',
        priority: 'HIGH',
      },
    },
  ],
};

const chatListItem = {
  id: 'chat-1',
  title: 'QA follow-up draft',
  summary: null,
  lastMessagePreview: 'I drafted the task for review.',
  messageCount: 2,
  createdAt: '2026-05-03T11:30:00.000Z',
  updatedAt: '2026-05-03T11:31:00.000Z',
  lastMessageAt: '2026-05-03T11:31:00.000Z',
};

const chat = {
  ...chatListItem,
  messages: [
    {
      id: 'message-1',
      sequence: 1,
      role: 'USER',
      content: 'Create a QA follow-up task for visual checks.',
      createdAt: '2026-05-03T11:30:00.000Z',
    },
    {
      id: 'message-2',
      sequence: 2,
      role: 'ASSISTANT',
      content: 'I drafted the task for review.',
      createdAt: '2026-05-03T11:31:00.000Z',
      draft: {
        id: 'draft-1',
        status: 'PENDING',
        originalDraft: draft,
        approvedDraft: null,
        executionResult: null,
        createdAt: '2026-05-03T11:31:00.000Z',
        updatedAt: '2026-05-03T11:31:00.000Z',
        decidedAt: null,
        executedAt: null,
      },
    },
  ],
};

const screens = [
  {
    name: 'dashboard-table-desktop',
    route: '/dashboard?view=table',
    viewport: { width: 1440, height: 1000 },
    readyText: 'Finalize assistant review flow',
  },
  {
    name: 'dashboard-board-mobile',
    route: '/dashboard?view=board',
    viewport: { width: 390, height: 900 },
    readyText: 'Finalize assistant review flow',
  },
  {
    name: 'task-detail-desktop',
    route: '/tasks/task-1',
    viewport: { width: 1440, height: 1000 },
    readyText: 'Design review is ready',
  },
  {
    name: 'assistant-workspace-desktop',
    route: '/assistant',
    viewport: { width: 1440, height: 1000 },
    readyText: 'Create the QA follow-up task',
  },
];

mkdirSync(runDir, { recursive: true });

const server = await startViteServer();
let browser;

try {
  browser = await launchBrowser();

  const captures = [];
  for (const screen of screens) {
    captures.push(await captureScreen(browser, screen));
  }

  if (updateBaselineDir) {
    mkdirSync(updateBaselineDir, { recursive: true });
    for (const capture of captures) {
      copyFileSync(capture.path, path.join(updateBaselineDir, path.basename(capture.path)));
    }
    console.log(`Updated visual baseline: ${path.relative(repoRoot, updateBaselineDir)}`);
  }

  if (baselineDir) {
    compareCaptures(captures, baselineDir);
  }

  console.log(`Visual smoke screenshots: ${path.relative(repoRoot, runDir)}`);
} finally {
  await browser?.close();
  stopServer(server);
}

async function captureScreen(browserInstance, screen) {
  const context = await browserInstance.newContext({
    viewport: screen.viewport,
    deviceScaleFactor: 1,
  });

  await context.addInitScript(() => {
    window.localStorage.setItem('token', 'visual-token');
  });
  await context.route('**/api/**', fulfillMockApi);

  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${screen.route}`, { waitUntil: 'networkidle' });
  await page.getByText(screen.readyText).first().waitFor({ state: 'visible', timeout: 10000 });

  const screenshotPath = path.join(runDir, `${screen.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();

  console.log(`Captured ${screen.name}: ${path.relative(repoRoot, screenshotPath)}`);
  return { ...screen, path: screenshotPath };
}

async function fulfillMockApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/auth/me') {
    return fulfillJson(route, { user });
  }

  if (method === 'GET' && pathname === '/api/tasks') {
    return fulfillJson(route, filterTasks(url));
  }

  if (method === 'GET' && pathname === '/api/tasks/task-1') {
    return fulfillJson(route, tasks[0]);
  }

  if (method === 'GET' && pathname === '/api/comments' && url.searchParams.get('taskId') === 'task-1') {
    return fulfillJson(route, comments);
  }

  if (method === 'GET' && pathname === '/api/assistant/chats') {
    return fulfillJson(route, { chats: [chatListItem] });
  }

  if (method === 'GET' && pathname === '/api/assistant/chats/chat-1') {
    return fulfillJson(route, { chat });
  }

  return fulfillJson(route, { error: `Unexpected visual mock request: ${method} ${pathname}` }, 404);
}

function filterTasks(url) {
  const search = url.searchParams.get('search')?.toLowerCase();
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');

  return tasks.filter((task) => {
    if (search && !`${task.title} ${task.description}`.toLowerCase().includes(search)) {
      return false;
    }

    if (status && task.status !== status) {
      return false;
    }

    if (priority && task.priority !== priority) {
      return false;
    }

    return true;
  });
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function compareCaptures(captures, expectedDir) {
  if (!existsSync(expectedDir)) {
    throw new Error(`Visual baseline directory does not exist: ${expectedDir}`);
  }

  let failed = false;

  for (const capture of captures) {
    const expectedPath = path.join(expectedDir, path.basename(capture.path));

    if (!existsSync(expectedPath)) {
      console.error(`Missing baseline for ${capture.name}: ${expectedPath}`);
      failed = true;
      continue;
    }

    const expected = PNG.sync.read(readFileSync(expectedPath));
    const actual = PNG.sync.read(readFileSync(capture.path));

    if (expected.width !== actual.width || expected.height !== actual.height) {
      console.error(
        `${capture.name} dimensions changed: expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`,
      );
      failed = true;
      continue;
    }

    const diff = new PNG({ width: expected.width, height: expected.height });
    const diffPixels = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
      threshold: 0.12,
    });

    if (diffPixels > allowedPixels) {
      const diffPath = path.join(runDir, `${capture.name}.diff.png`);
      writeFileSync(diffPath, PNG.sync.write(diff));
      console.error(
        `${capture.name} changed by ${diffPixels} pixels; diff: ${path.relative(repoRoot, diffPath)}`,
      );
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log(`Visual check passed against ${path.relative(repoRoot, expectedDir)}`);
}

async function startViteServer() {
  const isWindows = process.platform === 'win32';
  const command = isWindows
    ? `npm run dev -- --host ${host} --port ${port} --strictPort`
    : 'npm';
  const args = isWindows
    ? []
    : ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'];
  const child = spawn(
    command,
    args,
    {
      cwd,
      env: { ...process.env, BROWSER: 'none' },
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let logs = '';

  child.stdout.on('data', (data) => {
    logs += data.toString();
  });
  child.stderr.on('data', (data) => {
    logs += data.toString();
  });

  await waitForServer(() => logs);
  return child;
}

async function waitForServer(readLogs) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Vite dev server did not start at ${baseUrl}\n${readLogs()}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: process.env.VISUAL_HEADED !== '1' });
  } catch (error) {
    throw new Error(
      `${messageForError(error)}\nInstall the Chromium browser once with: npx playwright install chromium`,
    );
  }
}

function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  child.kill();
}

function readOption(name) {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((argument) => argument.startsWith(prefix));

  if (withEquals) {
    return withEquals.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return null;
}

function resolveOptionalPath(value) {
  if (!value) {
    return null;
  }

  return path.resolve(cwd, value);
}

function messageForError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}
