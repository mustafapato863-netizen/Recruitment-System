// Notifications and Task (WorkItem) contracts
// Phase 10

export interface NotificationRecord {
  id: string;
  organizationId: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationFilterInput {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Dismissed';

export interface TaskRecord {
  id: string;
  organizationId: string;
  assigneeUserId: string;
  createdById: string;
  type: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  entityType: string | null;
  entityId: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTaskStatusInput {
  status: TaskStatus;
}

export interface TaskFilterInput {
  status?: TaskStatus;
  priority?: TaskPriority;
  overdueOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}
