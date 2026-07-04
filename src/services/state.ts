import fs from "node:fs/promises";
import path from "node:path";
import type { TaskState } from "../domain/types";
export class TaskStateService { constructor(private readonly directory: string) {} async save(state: TaskState) { state.updatedAt = new Date().toISOString(); await fs.mkdir(this.directory, { recursive: true }); await fs.writeFile(path.join(this.directory, `${state.id}.json`), JSON.stringify(state, null, 2), "utf8"); } async latest() { try { const files = await fs.readdir(this.directory); const states = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await fs.readFile(path.join(this.directory, file), "utf8")) as TaskState)); return states.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; } catch { return undefined; } } }
