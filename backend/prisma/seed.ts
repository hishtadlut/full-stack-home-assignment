import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type SeedTaskInput = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  userId: string;
};

type SeedCommentInput = {
  id: string;
  content: string;
  taskId: string;
  userId: string;
};

async function main() {
  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user1 = await prisma.user.upsert({
    where: { id: 'user1' },
    update: {},
    create: {
      id: 'user1',
      email: 'john@example.com',
      username: 'johndoe',
      password: hashedPassword,
      name: 'John Doe',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { id: 'user2' },
    update: {},
    create: {
      id: 'user2',
      email: 'jane@example.com',
      username: 'janedoe',
      password: hashedPassword,
      name: 'Jane Doe',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { id: 'user3' },
    update: {},
    create: {
      id: 'user3',
      email: 'bob@example.com',
      username: 'bobsmith',
      password: hashedPassword,
      name: 'Bob Smith',
    },
  });

  const task1 = await upsertSeedTask({
    id: 'task-user-authentication',
    title: 'Implement user authentication',
    description: 'Add login and registration functionality',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    userId: user1.id,
  });
  const task2 = await upsertSeedTask({
    id: 'task-dashboard-ui',
    title: 'Design dashboard UI',
    description: 'Create responsive dashboard layout with Tailwind CSS',
    status: 'TODO',
    priority: 'MEDIUM',
    userId: user1.id,
  });
  const task3 = await upsertSeedTask({
    id: 'task-login-bug',
    title: 'Fix login bug',
    description: 'Users cannot log in with special characters in password',
    status: 'TODO',
    priority: 'HIGH',
    userId: user2.id,
  });
  const task4 = await upsertSeedTask({
    id: 'task-ci-cd-pipeline',
    title: 'Setup CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    userId: user1.id,
  });
  const task5 = await upsertSeedTask({
    id: 'task-filtering',
    title: 'Implement task filtering',
    description: 'Add filter by status, priority, and assignee',
    status: 'DONE',
    priority: 'LOW',
    userId: user2.id,
  });

  // Create task assignments
  for (const assignment of [
    { taskId: task1.id, userId: user1.id },
    { taskId: task1.id, userId: user2.id },
    { taskId: task1.id, userId: user3.id },
    { taskId: task2.id, userId: user1.id },
    { taskId: task3.id, userId: user1.id },
    { taskId: task3.id, userId: user2.id },
    { taskId: task4.id, userId: user1.id },
    { taskId: task5.id, userId: user2.id },
  ]) {
    await ensureTaskAssignment(assignment.taskId, assignment.userId);
  }

  // Create comments
  await upsertSeedComment({
    id: 'comment-auth-jwt-started',
    content: 'Started working on JWT implementation',
    taskId: task1.id,
    userId: user1.id,
  });

  await upsertSeedComment({
    id: 'comment-auth-refresh-token',
    content: 'Need to add refresh token functionality',
    taskId: task1.id,
    userId: user2.id,
  });

  await upsertSeedComment({
    id: 'comment-login-critical',
    content: 'This is a critical bug, needs immediate attention',
    taskId: task3.id,
    userId: user2.id,
  });

  await upsertSeedComment({
    id: 'comment-login-password-fixed',
    content: 'Fixed the issue with password encoding',
    taskId: task3.id,
    userId: user1.id,
  });

  console.log('Seed data created successfully!');
}

const upsertSeedTask = async ({ id, title, description, status, priority, userId }: SeedTaskInput) => {
  const existingTask = await prisma.task.findFirst({
    where: {
      OR: [
        { id },
        { title, userId },
      ],
    },
  });

  if (existingTask) {
    return prisma.task.update({
      where: { id: existingTask.id },
      data: {
        title,
        description,
        status,
        priority,
        userId,
      },
    });
  }

  return prisma.task.create({
    data: {
      id,
      title,
      description,
      status,
      priority,
      userId,
    },
  });
};

const ensureTaskAssignment = async (taskId: string, userId: string) =>
  prisma.taskAssignment.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    update: {},
    create: {
      taskId,
      userId,
    },
  });

const upsertSeedComment = async ({ id, content, taskId, userId }: SeedCommentInput) => {
  const existingComment = await prisma.comment.findFirst({
    where: {
      OR: [
        { id },
        { content, taskId, userId },
      ],
    },
  });

  if (existingComment) {
    return prisma.comment.update({
      where: { id: existingComment.id },
      data: {
        content,
        taskId,
        userId,
      },
    });
  }

  return prisma.comment.create({
    data: {
      id,
      content,
      taskId,
      userId,
    },
  });
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
