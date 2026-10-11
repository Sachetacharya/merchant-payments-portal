import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Role } from './role.enum.js';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

const SEED_PASSWORD = 'Password123!';

@Injectable()
export class UsersStore {
  private readonly users: StoredUser[] = [
    {
      id: 'u-sales-1',
      name: 'Sam Sales',
      email: 'sales@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Sales,
    },
    {
      id: 'u-sales-2',
      name: 'Priya Patel',
      email: 'sales2@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Sales,
    },
    {
      id: 'u-sales-3',
      name: 'Marcus Chen',
      email: 'sales3@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Sales,
    },
    {
      id: 'u-reviewer-1',
      name: 'Riya Reviewer',
      email: 'reviewer@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Reviewer,
    },
    {
      id: 'u-reviewer-2',
      name: 'Daniel Okafor',
      email: 'reviewer2@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Reviewer,
    },
    {
      id: 'u-admin-1',
      name: 'Avery Admin',
      email: 'admin@merchantportal.test',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: Role.Admin,
    },
  ];

  findByEmail(email: string): StoredUser | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  findById(id: string): StoredUser | undefined {
    return this.users.find((user) => user.id === id);
  }

  listByRole(role: Role): StoredUser[] {
    return this.users.filter((user) => user.role === role);
  }
}
