import { createSeedData } from './seed';
import {
  ChangeOrderRecord,
  ContractRecord,
  CostEntryRecord,
  CostItemRecord,
  DbSchema,
  DrawingRecord,
  InspectionRecord,
  MaterialRecord,
  NotificationRecord,
  PaymentRecord,
  MaterialRequestRecord,
  ProjectRecord,
  PunchRecord,
  StockRecord,
  StockTransactionRecord,
  SiteDiaryRecord,
  TaskCommentRecord,
  TaskRecord,
  UserRecord,
  WbsRecord,
} from './models/mock-records';

const STORAGE_KEY = 'cpm.mock-db';
/** Tăng version khi đổi cấu trúc DbSchema để buộc seed lại dữ liệu cũ trong localStorage. */
const SCHEMA_VERSION = 9;

interface PersistedDb {
  readonly version: number;
  readonly data: DbSchema;
}

type Entity = { readonly id: string };

/** Một bảng trong fake DB. Mọi thao tác ghi đều được persist xuống localStorage. */
export class Collection<T extends Entity> {
  constructor(
    private readonly read: () => T[],
    private readonly write: (items: T[]) => void,
  ) {}

  all(): T[] {
    return [...this.read()];
  }

  findById(id: string): T | undefined {
    return this.read().find((item) => item.id === id);
  }

  findOne(predicate: (item: T) => boolean): T | undefined {
    return this.read().find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.read().filter(predicate);
  }

  insert(item: T): T {
    this.write([...this.read(), item]);
    return item;
  }

  update(id: string, changes: Partial<Omit<T, 'id'>>): T | undefined {
    const current = this.findById(id);
    if (!current) {
      return undefined;
    }
    const updated: T = { ...current, ...changes, id };
    this.write(this.read().map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  remove(id: string): boolean {
    const items = this.read();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) {
      return false;
    }
    this.write(next);
    return true;
  }

  /** Xoá mọi bản ghi thoả điều kiện, trả về số bản ghi đã xoá. */
  removeWhere(predicate: (item: T) => boolean): number {
    const items = this.read();
    const next = items.filter((item) => !predicate(item));
    if (next.length !== items.length) {
      this.write(next);
    }
    return items.length - next.length;
  }
}

class MockDatabase {
  private data: DbSchema;

  readonly users = new Collection<UserRecord>(
    () => this.data.users,
    (users) => this.commit({ ...this.data, users }),
  );

  readonly projects = new Collection<ProjectRecord>(
    () => this.data.projects,
    (projects) => this.commit({ ...this.data, projects }),
  );

  readonly wbs = new Collection<WbsRecord>(
    () => this.data.wbs,
    (wbs) => this.commit({ ...this.data, wbs }),
  );

  readonly tasks = new Collection<TaskRecord>(
    () => this.data.tasks,
    (tasks) => this.commit({ ...this.data, tasks }),
  );

  readonly taskComments = new Collection<TaskCommentRecord>(
    () => this.data.taskComments,
    (taskComments) => this.commit({ ...this.data, taskComments }),
  );

  readonly siteDiaries = new Collection<SiteDiaryRecord>(
    () => this.data.siteDiaries,
    (siteDiaries) => this.commit({ ...this.data, siteDiaries }),
  );

  readonly materials = new Collection<MaterialRecord>(
    () => this.data.materials,
    (materials) => this.commit({ ...this.data, materials }),
  );

  readonly stock = new Collection<StockRecord>(
    () => this.data.stock,
    (stock) => this.commit({ ...this.data, stock }),
  );

  readonly stockTransactions = new Collection<StockTransactionRecord>(
    () => this.data.stockTransactions,
    (stockTransactions) => this.commit({ ...this.data, stockTransactions }),
  );

  readonly materialRequests = new Collection<MaterialRequestRecord>(
    () => this.data.materialRequests,
    (materialRequests) => this.commit({ ...this.data, materialRequests }),
  );

  readonly contracts = new Collection<ContractRecord>(
    () => this.data.contracts,
    (contracts) => this.commit({ ...this.data, contracts }),
  );

  readonly costItems = new Collection<CostItemRecord>(
    () => this.data.costItems,
    (costItems) => this.commit({ ...this.data, costItems }),
  );

  readonly costEntries = new Collection<CostEntryRecord>(
    () => this.data.costEntries,
    (costEntries) => this.commit({ ...this.data, costEntries }),
  );

  readonly changeOrders = new Collection<ChangeOrderRecord>(
    () => this.data.changeOrders,
    (changeOrders) => this.commit({ ...this.data, changeOrders }),
  );

  readonly payments = new Collection<PaymentRecord>(
    () => this.data.payments,
    (payments) => this.commit({ ...this.data, payments }),
  );

  readonly inspections = new Collection<InspectionRecord>(
    () => this.data.inspections,
    (inspections) => this.commit({ ...this.data, inspections }),
  );

  readonly punchItems = new Collection<PunchRecord>(
    () => this.data.punchItems,
    (punchItems) => this.commit({ ...this.data, punchItems }),
  );

  readonly drawings = new Collection<DrawingRecord>(
    () => this.data.drawings,
    (drawings) => this.commit({ ...this.data, drawings }),
  );

  readonly notifications = new Collection<NotificationRecord>(
    () => this.data.notifications,
    (notifications) => this.commit({ ...this.data, notifications }),
  );

  constructor() {
    this.data = this.load() ?? createSeedData();
    this.persist();
  }

  /** Xoá toàn bộ thay đổi, nạp lại dữ liệu seed ban đầu. */
  reset(): void {
    this.data = createSeedData();
    this.persist();
  }

  private commit(next: DbSchema): void {
    this.data = next;
    this.persist();
  }

  private load(): DbSchema | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as PersistedDb;
      return parsed.version === SCHEMA_VERSION ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      const payload: PersistedDb = { version: SCHEMA_VERSION, data: this.data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage đầy hoặc bị chặn: dữ liệu vẫn sống trong bộ nhớ cho tới khi tải lại trang.
    }
  }
}

export const db = new MockDatabase();
