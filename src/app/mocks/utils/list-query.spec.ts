import { applyListQuery, parseListQuery } from './list-query';

interface Row {
  id: string;
  name: string;
  status: string;
  budget: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Chung cư Hoàng Mai', status: 'IN_PROGRESS', budget: 500 },
  { id: '2', name: 'Cầu Thủ Thiêm 4', status: 'PLANNING', budget: 900 },
  { id: '3', name: 'Nhà xưởng Bắc Ninh', status: 'IN_PROGRESS', budget: 200 },
  { id: '4', name: 'Trường học Đà Nẵng', status: 'DONE', budget: 300 },
];

function query(search: string) {
  return parseListQuery(new URL(`http://localhost/api/v1/projects${search}`));
}

describe('list-query', () => {
  it('dùng giá trị mặc định khi không truyền tham số', () => {
    const result = applyListQuery(ROWS, query(''), ['name']);
    expect(result).toEqual({ data: ROWS, total: 4, page: 1, pageSize: 10 });
  });

  it('phân trang theo page và pageSize', () => {
    const result = applyListQuery(ROWS, query('?page=2&pageSize=3'), ['name']);
    expect(result.data.map((row) => row.id)).toEqual(['4']);
    expect(result.total).toBe(4);
  });

  it('tìm kiếm không phân biệt dấu tiếng Việt', () => {
    const result = applyListQuery(ROWS, query('?q=da nang'), ['name']);
    expect(result.data.map((row) => row.id)).toEqual(['4']);
  });

  it('lọc theo field, hỗ trợ nhiều giá trị cách nhau dấu phẩy', () => {
    const result = applyListQuery(ROWS, query('?status=PLANNING,DONE'), ['name']);
    expect(result.data.map((row) => row.id)).toEqual(['2', '4']);
  });

  it('sắp xếp tăng/giảm dần', () => {
    expect(applyListQuery(ROWS, query('?sort=budget'), ['name']).data.map((row) => row.id)).toEqual([
      '3',
      '4',
      '1',
      '2',
    ]);
    expect(applyListQuery(ROWS, query('?sort=-budget'), ['name']).data[0].id).toBe('2');
  });
});
