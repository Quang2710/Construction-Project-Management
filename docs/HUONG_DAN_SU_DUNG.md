# Hướng dẫn sử dụng — Hệ thống Quản lý dự án xây dựng (CPM)

Tài liệu dành cho người dùng cuối: ban quản lý dự án, kỹ sư công trường và chủ đầu tư. Hệ thống chạy trên trình duyệt,
dùng được trên máy tính, máy tính bảng và điện thoại tại công trường.

## Mục lục

1. [Đăng nhập và vai trò](#1-đăng-nhập-và-vai-trò)
2. [Giao diện chung](#2-giao-diện-chung)
3. [Bảng điều khiển](#3-bảng-điều-khiển)
4. [Dự án](#4-dự-án)
5. [Bản đồ công trình](#5-bản-đồ-công-trình)
6. [Công việc (Kanban)](#6-công-việc-kanban)
7. [Tiến độ (Gantt)](#7-tiến-độ-gantt)
8. [Nhật ký công trường](#8-nhật-ký-công-trường)
9. [Chất lượng: nghiệm thu và punch list](#9-chất-lượng-nghiệm-thu-và-punch-list)
10. [Bản vẽ](#10-bản-vẽ)
11. [Vật tư](#11-vật-tư)
12. [Ngân sách](#12-ngân-sách)
13. [Thông báo](#13-thông-báo)
14. [Làm việc khi mất mạng](#14-làm-việc-khi-mất-mạng)
15. [Câu hỏi thường gặp](#15-câu-hỏi-thường-gặp)

---

## 1. Đăng nhập và vai trò

Mở trang đăng nhập, nhập **Email** và **Mật khẩu** được cấp rồi bấm **Đăng nhập**. Bấm biểu tượng con mắt để hiện/ẩn mật khẩu.

Mỗi tài khoản có một vai trò, quyết định những menu nhìn thấy và thao tác được phép:

| Vai trò | Dùng cho | Quyền chính |
| --- | --- | --- |
| **Quản trị hệ thống** | Bộ phận quản trị, phòng QA/QC | Toàn quyền; duyệt cấp 2 phiếu nghiệm thu |
| **Quản lý dự án** | Chỉ huy trưởng, PM | Quản lý dự án, hạng mục, ngân sách; duyệt nhật ký, phiếu vật tư, nghiệm thu cấp 1 |
| **Kỹ sư công trường** | Kỹ sư hiện trường | Công việc, nhật ký, vật tư, lập phiếu nghiệm thu, ghi nhận lỗi; chỉ thấy dự án được gán |
| **Chủ đầu tư** | Đại diện chủ đầu tư | **Chỉ xem**: dự án, tiến độ, nhật ký và nghiệm thu đã duyệt, ngân sách (không thấy lãi/lỗ) |

> Nếu mở một trang không thuộc quyền, hệ thống hiển thị trang **"Không có quyền truy cập"**.

### Tài khoản dùng thử

Bản demo có sẵn các tài khoản dưới đây, mật khẩu chung **`Demo@123`**. Ở trang đăng nhập có thể bấm thẳng vào từng tài
khoản để đăng nhập nhanh.

| Email | Vai trò |
| --- | --- |
| admin@cpm.vn | Quản trị hệ thống |
| pm@cpm.vn | Quản lý dự án |
| kysu@cpm.vn | Kỹ sư công trường |
| chudautu@cpm.vn | Chủ đầu tư |

Nút **Reset dữ liệu demo** (trang đăng nhập hoặc menu tài khoản) đưa toàn bộ dữ liệu về trạng thái ban đầu.

---

## 2. Giao diện chung

- **Thanh bên trái (menu)**: các module theo nhóm *Tổng quan*, *Thi công*, *Tài chính*, *Quản trị*. Trên điện thoại,
  bấm biểu tượng ☰ ở góc trên để mở menu.
- **Thanh trên cùng**:
  - Đường dẫn (breadcrumb) cho biết đang ở trang nào, bấm để quay lại cấp trên.
  - 🔔 **Chuông thông báo** — xem [mục 13](#13-thông-báo).
  - ☀️/🌙 **Chuyển giao diện sáng / tối**.
  - **Menu tài khoản**: tên, vai trò, *Cài đặt ứng dụng* (khi trình duyệt hỗ trợ), *Reset dữ liệu demo*, **Đăng xuất**.
- **Ô có dấu \*** là bắt buộc. Lỗi nhập liệu hiện màu đỏ ngay dưới ô sau khi rời khỏi ô đó.
- Các danh sách đều có ô **tìm kiếm** và **bộ lọc** ở phía trên.

> Các mục *Nhân sự*, *Báo cáo*, *Người dùng*, *Cấu hình hệ thống* đang được phát triển, hiện chỉ hiển thị trang giới thiệu.

---

## 3. Bảng điều khiển

Trang mở đầu sau khi đăng nhập, tổng hợp **các dự án bạn được gán**:

- Thẻ số liệu: *Dự án đang thi công*, *Chậm tiến độ*, *Vượt ngân sách*, *Công việc trễ hạn*.
- **Đường cong S tiến độ**: % lũy kế kế hoạch so với thực tế (trọng số theo ngân sách).
- **Ngân sách so với chi phí thực tế** và **Chi phí theo dự án**.
- **Cảnh báo công việc trễ hạn**: bấm vào một dòng để mở công việc.

---

## 4. Dự án

### Danh sách

- Tìm theo mã, tên dự án hoặc chủ đầu tư; lọc theo trạng thái (*Chuẩn bị đầu tư*, *Đang thi công*, *Tạm dừng*,
  *Hoàn thành*, *Đã huỷ*).
- Bấm vào một dự án để xem chi tiết.

### Tạo / sửa dự án *(Quản trị, Quản lý dự án)*

1. Bấm **Tạo dự án**.
2. Nhập **Thông tin chung**: mã dự án (3–20 ký tự in hoa, số, dấu gạch ngang; không trùng), tên, chủ đầu tư, mô tả.
3. **Thời gian & ngân sách**: ngày bắt đầu, ngày kết thúc (phải sau ngày bắt đầu), ngân sách (tối thiểu 1.000.000 ₫).
4. **Địa điểm công trình**: tỉnh/thành phố, địa chỉ và **bấm lên bản đồ** để chọn vị trí (hoặc nhập vĩ độ, kinh độ).
5. **Nhân sự**: chọn quản lý dự án và kỹ sư phụ trách. Kỹ sư chỉ xem được dự án mình được gán.
6. Bấm **Lưu**.

### Chi tiết dự án

Gồm các tab *Tổng quan* (tiến độ, ngân sách, thời gian còn lại, cảnh báo), *Công việc*, *Nhật ký* của dự án.

---

## 5. Bản đồ công trình

Hiển thị vị trí các công trình trên toàn quốc, màu điểm theo trạng thái dự án (xem chú giải). Bấm vào điểm trên bản đồ
hoặc vào một dòng trong danh sách bên cạnh để xem tóm tắt: mã, tên, địa chỉ, tiến độ, ngân sách.

---

## 6. Công việc (Kanban)

*Dành cho Quản trị, Quản lý dự án, Kỹ sư công trường.*

Bảng chia cột theo trạng thái: **Cần làm → Đang làm → Chờ nghiệm thu → Hoàn thành**.

- **Kéo thả thẻ** sang cột khác để cập nhật trạng thái. Trên điện thoại: nhấn giữ thẻ một chút rồi kéo.
- Bộ lọc phía trên: chọn **Dự án**, **Lọc nhanh** theo tiêu đề / nhãn / người phụ trách, bật **Chỉ việc của tôi**.
- Bấm **Thêm công việc** để tạo mới, hoặc bấm vào thẻ để mở chi tiết:
  - Tiêu đề, mô tả, dự án, hạng mục WBS, người phụ trách, mức ưu tiên (*Thấp*, *Trung bình*, *Cao*, *Khẩn cấp*).
  - Ngày bắt đầu, hạn hoàn thành; tích **Mốc tiến độ** nếu là mốc không có thời lượng.
  - **Nhãn**: gõ rồi nhấn Enter hoặc dấu phẩy để thêm.
  - **Bình luận**: gõ nội dung, nhấn **Ctrl + Enter** hoặc bấm nút gửi.
- Thẻ quá hạn được đánh dấu đỏ. Chỉ Quản trị và Quản lý dự án được **xoá** công việc.

---

## 7. Tiến độ (Gantt)

Biểu đồ Gantt theo hạng mục WBS và công việc của một dự án.

- Chọn **Dự án**, đổi thang thời gian **Ngày / Tuần / Tháng / Quý**, bấm **Hôm nay** để cuộn tới ngày hiện tại.
- **Kéo thanh công việc** để dời ngày thực hiện.
- **Nối hai công việc** (kéo từ đầu nối của công việc trước sang công việc sau) để tạo liên kết phụ thuộc; bấm vào
  đường nối để xoá liên kết.
- Chú giải màu: *Đường găng* (công việc không được phép trễ), *Có dự trữ*, *Đã hoàn thành*, *Mốc tiến độ*.
- Quản trị / Quản lý dự án có nút **Thêm hạng mục WBS** (chọn hạng mục cha nếu là cấp con).

> Chủ đầu tư chỉ xem, không kéo thả được.

---

## 8. Nhật ký công trường

Báo cáo thi công hằng ngày cho từng dự án.

### Xem nhật ký

- Dạng **lịch theo tháng**: mỗi ngày có nhật ký được đánh dấu trạng thái; dùng nút *Tháng trước / Tháng sau* hoặc **Hôm nay**.
- Bấm vào ngày để **Xem nhật ký**. Chủ đầu tư chỉ thấy nhật ký đã được duyệt.

### Lập nhật ký *(Kỹ sư, Quản lý dự án, Quản trị)*

1. Bấm **Lập nhật ký hôm nay** (hoặc **Lập nhật ký cho ngày này** khi chọn một ngày trên lịch), chọn dự án và **ngày báo cáo** (mỗi dự án một nhật ký/ngày, không lập cho ngày tương lai).
2. **Thời tiết** buổi sáng, buổi chiều; nhiệt độ thấp nhất / cao nhất.
3. **Nhân công**: bấm *Thêm tổ đội*, nhập tên tổ đội, số người.
4. **Máy móc, thiết bị**: bấm *Thêm thiết bị*, nhập số lượng, giờ chạy.
5. **Khối lượng hoàn thành**: bấm *Thêm hạng mục*, nhập hạng mục, ĐVT, khối lượng.
6. **Sự cố, an toàn lao động**: bấm **Ghi nhận sự cố** nếu có (loại, mức độ, mô tả, biện pháp xử lý).
7. **Ảnh hiện trường**: chụp hoặc chọn ảnh. Ảnh tự nén và gắn **vị trí GPS** (cần cho phép định vị); ảnh chụp cách công
   trình hơn 1 km sẽ bị đánh dấu.
8. Lưu thành **Bản nháp**, sau đó bấm **Gửi duyệt**.

### Quy trình duyệt

```
Bản nháp ──Gửi duyệt──► Chờ duyệt ──Phê duyệt──► Đã duyệt (khoá)
                            │
                            └──Trả lại (kèm lý do)──► Bị trả lại ──sửa & gửi lại──► Chờ duyệt
```

- Khi **Chờ duyệt** hoặc **Đã duyệt**, nhật ký bị khoá chỉnh sửa.
- Quản lý dự án / Quản trị bấm **Phê duyệt** hoặc **Trả lại** (lý do hiển thị cho người lập).
- Bản nháp có thể xoá. Bấm **Xuất PDF** để tải báo cáo ngày.

---

## 9. Chất lượng: nghiệm thu và punch list

### Phiếu nghiệm thu

1. Tab **Nghiệm thu** → **Lập phiếu nghiệm thu**: chọn dự án, hạng mục (WBS), mẫu checklist, tên phiếu, vị trí, ngày.
2. Mở phiếu, chấm từng tiêu chí: **Đạt**, **Không đạt**, **Không áp dụng**, ghi chú / số đo thực tế. Nút **Đạt các mục
   còn lại** chấm nhanh các mục chưa chấm.
3. Cần thêm tiêu chí: nhập **Tiêu chí bổ sung** + **Yêu cầu kỹ thuật** rồi bấm **Thêm**.
4. Tiêu chí *Không đạt* có thể **ghi nhận lỗi** ngay (tạo punch item, xem bên dưới).
5. Bấm **Lưu**, rồi **Gửi duyệt**.

**Duyệt 2 cấp** (tuần tự, theo dõi ở khung *Quy trình duyệt*):

| Cấp | Người duyệt |
| --- | --- |
| 1 | Chỉ huy trưởng / Quản lý dự án |
| 2 | Phòng QA/QC (Quản trị) |

Kết quả: **Đã nghiệm thu** hoặc **Không đạt / Trả lại** (người lập sửa rồi gửi lại).

### Punch list (lỗi cần xử lý)

1. Tab **Punch list** → **Ghi nhận lỗi**: mô tả, vị trí, mức độ, người xử lý, hạn xử lý và **ít nhất 1 ảnh hiện trạng**.
   Bấm **Ghi nhận & giao việc**.
2. Người xử lý sửa xong bấm **Báo đã khắc phục**, nhập nội dung đã xử lý và **ít nhất 1 ảnh sau khắc phục**.
3. Quản lý dự án / Quản trị kiểm tra ảnh **trước / sau** rồi **Xác nhận đóng**, hoặc **Mở lại** / **Giao lại / đổi hạn**.

Trạng thái: **Mới → Đang xử lý → Chờ xác nhận → Đã đóng**. Bộ lọc: tìm kiếm, mức độ, trạng thái, *Giao cho tôi*, *Quá hạn*.

---

## 10. Bản vẽ

- Chọn **Dự án**, tìm theo số hiệu hoặc tên bản vẽ. Bản vẽ được nhóm theo bộ môn (*Kiến trúc*, *Kết cấu*, *Cơ điện*,
  *Hạ tầng*…).
- Bấm vào bản vẽ để xem PDF: chuyển trang, **Phóng to / Thu nhỏ / Vừa khung**.
- **Lịch sử phát hành** liệt kê các phiên bản (Rev); phiên bản đang dùng có nhãn *Hiện hành*.
- **So sánh phiên bản**: chọn phiên bản cần so sánh, xem **Cạnh nhau** hoặc **Chồng lớp** để thấy chỗ thay đổi.
- *(Quản trị, Quản lý dự án)* **Phát hành** bản vẽ mới hoặc phiên bản mới: nhập số hiệu, tên, bộ môn và **Chọn tệp PDF**.

---

## 11. Vật tư

*Dành cho Quản trị, Quản lý dự án, Kỹ sư công trường.* Chọn công trường ở đầu trang, gồm 4 tab:

### Tồn kho

- Danh sách vật tư tại công trường, **Giá trị tồn** tổng. Bật **Chỉ vật tư thiếu** để lọc vật tư dưới mức tối thiểu.
- Khi có vật tư thiếu, hệ thống cảnh báo và có nút **Lập phiếu bổ sung**.
- **Nhập kho / Xuất kho**: chọn vật tư, số lượng (không xuất quá tồn), ghi chú.
- **Quét mã QR**: quét nhãn trên vật tư bằng camera điện thoại để tra cứu nhanh; nếu không quét được, nhập mã vật tư
  rồi bấm **Tra cứu**.

### Phiếu yêu cầu

1. **Lập phiếu yêu cầu**: thêm từng vật tư + số lượng (mỗi vật tư một dòng), **Cần trước ngày**, mục đích sử dụng.
   Hệ thống tính **Giá trị ước tính**. Bấm **Gửi phiếu**.
2. Quản lý dự án / Quản trị **Duyệt** hoặc **Từ chối** (kèm lý do).
3. Khi hàng về, bấm **Xác nhận nhập kho** — tồn kho tự cộng.

Trạng thái: **Chờ duyệt → Đã duyệt, chờ nhập kho → Đã nhập kho** (hoặc *Từ chối*).

### Lịch sử nhập/xuất

Toàn bộ giao dịch kho, lọc theo *Nhập kho* / *Xuất kho*, có cột tồn sau giao dịch.

### Danh mục vật tư *(Quản trị, Quản lý dự án)*

Thêm / sửa vật tư: mã (dùng làm nội dung mã QR), tên, nhóm, đơn vị tính, đơn giá, mức tồn tối thiểu. Bấm **In nhãn**
để in nhãn QR dán lên vật tư.

---

## 12. Ngân sách

*Dành cho Quản trị, Quản lý dự án, Chủ đầu tư (chỉ xem, không thấy lãi/lỗ).* Chọn dự án, gồm các tab:

| Tab | Nội dung |
| --- | --- |
| **Tổng quan** | Dự toán vs thực tế theo hạng mục (vạch đen = % khối lượng hoàn thành), chi phí theo loại, dòng tiền 12 tháng; cảnh báo hạng mục **vượt dự toán** hoặc **chi nhanh hơn khối lượng** |
| **Chi phí** | Chứng từ chi phí thực tế. **Ghi nhận chi phí**: hạng mục, loại (vật tư, nhân công, máy thi công, thầu phụ, chi phí chung…), số tiền, ngày chứng từ, nhà cung cấp, số hoá đơn |
| **Phát sinh** | Đề xuất phát sinh (change order): tên, giá trị hợp đồng tăng thêm, chi phí thực hiện tăng thêm, căn cứ. **Gửi đề xuất** → **Chấp thuận** / **Không chấp thuận** |
| **Thanh toán** | Các đợt thanh toán theo hợp đồng: *Chưa đến hạn → Đã đề nghị thanh toán → Đã thanh toán*. **Xác nhận đã thu** ghi số tiền thực nhận (có thể thấp hơn nếu chủ đầu tư giữ lại bảo hành / tạm ứng) |
| **Lãi/lỗ các dự án** | *(Quản trị, Quản lý dự án)* Lãi/lỗ đến nay và dự báo của từng dự án |

Mọi số tiền hiển thị theo VND (₫).

---

## 13. Thông báo

- Thông báo đến **ngay lập tức** (công việc được giao, nhật ký chờ duyệt, phiếu vật tư, cảnh báo thời tiết…) và hiện
  ở góc dưới màn hình. Thông báo có liên kết kèm nút **Xem** để mở nhanh.
- 🔔 Chuông trên thanh trên cùng hiển thị số thông báo chưa đọc; bấm để xem danh sách gần nhất.
- Trang **Thông báo** liệt kê toàn bộ, lọc *Tất cả* / *Chưa đọc*; bấm vào thông báo để mở và đánh dấu đã đọc, hoặc đánh dấu tất cả đã đọc một lần.

---

## 14. Làm việc khi mất mạng

Hệ thống hỗ trợ làm việc tại công trường có sóng yếu:

- Dữ liệu đã xem được lưu tạm, vẫn mở lại được khi mất mạng. Biểu tượng trên thanh trên cùng cho biết đang **ngoại tuyến**.
- **Nhật ký công trường** lập khi mất mạng được đưa vào hàng đợi (*Tải lên khi có mạng*) và **tự đồng bộ** khi có kết nối.
- Có thể **Cài đặt ứng dụng** (menu tài khoản) để mở như ứng dụng trên điện thoại / máy tính.
- Khi có phiên bản mới, hệ thống thông báo và có nút **Tải lại**.

---

## 15. Câu hỏi thường gặp

**Tôi không thấy menu Vật tư / Ngân sách / Công việc?**
Menu hiển thị theo vai trò (xem [mục 1](#1-đăng-nhập-và-vai-trò)). Liên hệ quản trị nếu cần thêm quyền.

**Kỹ sư không thấy dự án?**
Kỹ sư chỉ thấy dự án mình được gán. Quản lý dự án cần thêm kỹ sư vào mục *Nhân sự* của dự án.

**Không sửa được nhật ký?**
Nhật ký đang *Chờ duyệt* hoặc *Đã duyệt* bị khoá. Nếu cần sửa, đề nghị người duyệt **Trả lại**.

**Ảnh không có vị trí GPS?**
Cho phép trình duyệt truy cập vị trí, bật định vị trên điện thoại rồi chụp lại.

**Không quét được mã QR?**
Trình duyệt cần hỗ trợ quét mã và được cấp quyền camera. Nếu không, nhập mã vật tư in trên nhãn rồi bấm **Tra cứu**.

**Muốn đưa dữ liệu demo về ban đầu?**
Menu tài khoản → **Reset dữ liệu demo**.
