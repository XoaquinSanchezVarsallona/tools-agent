export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const users: User[] = [];
let nextId = 1;

export function createUser(data: Omit<User, "id">): User {
  const user: User = { id: String(nextId++), ...data };
  users.push(user);
  return user;
}

export function listUsers(): User[] {
  return users;
}

export function resetUsers(): void {
  users.length = 0;
  nextId = 1;
}
