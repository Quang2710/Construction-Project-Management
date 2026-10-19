import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../core/notifications/notification.service';
import { Project } from '../../projects/models/project.model';
import { Material, StockItem } from '../models/material.model';
import { MaterialsStore } from './materials.store';

const PROJECTS = [
  { id: 'prj-done', code: 'A', status: 'COMPLETED' },
  { id: 'prj-plan', code: 'B', status: 'PLANNING' },
  { id: 'prj-run', code: 'C', status: 'IN_PROGRESS' },
] as Project[];

const CEMENT = { id: 'mat-1', code: 'XM', name: 'Xi măng', unit: 'bao', category: 'CEMENT', unitPrice: 90_000, description: '' } as Material;

function stock(quantity: number, minQuantity: number): StockItem {
  return {
    id: 'prj-run:mat-1',
    projectId: 'prj-run',
    projectCode: 'C',
    material: CEMENT,
    quantity,
    minQuantity,
    value: quantity * CEMENT.unitPrice,
    isLow: quantity < minQuantity,
    updatedAt: '',
  };
}

const page = <T>(data: T[]) => ({ data, total: data.length, page: 1, pageSize: 500 });

/** Chờ các chuỗi async/await trong store chạy tới request HTTP tiếp theo. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('MaterialsStore', () => {
  let store: InstanceType<typeof MaterialsStore>;
  let http: HttpTestingController;
  const notification = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [MaterialsStore, provideHttpClient(), provideHttpClientTesting(), { provide: NotificationService, useValue: notification }],
    });
    store = TestBed.inject(MaterialsStore);
    http = TestBed.inject(HttpTestingController);

    const init = store.init(null);
    http.expectOne((req) => req.url === '/api/v1/projects').flush(page(PROJECTS));
    http.expectOne((req) => req.url === '/api/v1/materials').flush(page([CEMENT]));
    await settle();
    http.expectOne((req) => req.url === '/api/v1/stock').flush([stock(20, 50)]);
    await init;
  });

  afterEach(() => http.verify());

  it('chỉ lấy công trường đang hoạt động, mặc định chọn công trường đang thi công', () => {
    expect(store.projects().map((project) => project.id)).toEqual(['prj-plan', 'prj-run']);
    expect(store.projectId()).toBe('prj-run');
    expect(store.lowStock()).toHaveLength(1);
    expect(store.stockValue()).toBe(20 * 90_000);
  });

  it('xuất kho: POST giao dịch rồi tải lại tồn kho và lịch sử', async () => {
    const pending = store.moveStock('OUT', 'mat-1', 5, 'Đổ cột');
    const post = http.expectOne((req) => req.url === '/api/v1/stock-transactions' && req.method === 'POST');
    expect(post.request.body).toEqual({ projectId: 'prj-run', materialId: 'mat-1', type: 'OUT', quantity: 5, note: 'Đổ cột' });
    post.flush({});
    await settle();
    http.expectOne((req) => req.url === '/api/v1/stock').flush([stock(15, 50)]);
    http.expectOne((req) => req.url === '/api/v1/stock-transactions' && req.method === 'GET').flush(page([]));

    await expect(pending).resolves.toBe(true);
    expect(store.stock()[0].quantity).toBe(15);
    expect(notification.success).toHaveBeenCalled();
  });
});
