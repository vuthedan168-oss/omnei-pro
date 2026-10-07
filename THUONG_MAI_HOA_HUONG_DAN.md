# 🚀 CẨM NANG THƯƠNG MẠI HÓA OMNEI PRO HOÀN TOÀN MIỄN PHÍ (0 ĐỒNG)

Chào bạn! Dưới đây là chiến lược chi tiết từ A-Z để bạn vận hành, bảo vệ bản quyền, đẩy code lên GitHub và bán sản phẩm này kiếm tiền mà **KHÔNG tốn 1 đồng chi phí duy trì server hay hạ tầng (100% Free)**.

---

## PHẦN 1: HƯỚNG DẪN ĐẨY DỰ ÁN LÊN GITHUB (100% MIỄN PHÍ)

### Bước 1: Tạo Repository trên GitHub
1. Truy cập vào [github.com](https://github.com) và đăng nhập tài khoản của bạn.
2. Bấm vào nút dấu **`+`** ở góc trên bên phải màn hình -> Chọn **New repository**.
3. Điền thông tin:
   - **Repository name**: `omnei-pro` (hoặc tên tùy thích).
   - **Description**: `OMNEI Pro - Ultimate Multi-Session & Antidetect Manager`.
   - **Visibility**: 
     - **Private (Khuyến nghị)**: Nếu bạn muốn giữ bí mật mã nguồn gốc, không cho người khác copy.
     - **Public**: Nếu bạn muốn mở mã nguồn cho cộng đồng và dùng GitHub Pages làm web tải công khai.
   - Bỏ tích ô *"Add a README file"* (vì ta đã tạo file README sẵn trên máy).
4. Bấm nút **Create repository**.

### Bước 2: Chạy lệnh đẩy code từ máy lên GitHub
Mở PowerShell tại thư mục `c:\Users\Dell\Documents\codevip` và chạy lần lượt các lệnh sau (thay `username` bằng tên tài khoản GitHub của bạn):

```powershell
# 1. Thêm link remote tới repo của bạn
git remote add origin https://github.com/YOUR_USERNAME/omnei-pro.git

# 2. Đổi tên nhánh chính thành main
git branch -M main

# 3. Đẩy code lên GitHub
git push -u origin main
```
*(Nếu hệ thống hỏi đăng nhập, bạn chỉ cần chọn Đăng nhập bằng trình duyệt "Sign in with a browser" là xong!)*

---

## PHẦN 2: LƯU TRỮ & PHÂN PHỐI FILE CÀI ĐẶT CHO KHÁCH (0 ĐỒNG)

### Cách dùng GitHub Releases để làm link tải tốc độ cao:
1. Vào trang repo GitHub của bạn, nhìn bên cột phải có mục **Releases** -> Bấm **Create a new release**.
2. Đặt tag: `v5.0.0`
3. Kéo thả file `OMNEI-Pro-v5.0-Commercial.zip` vào ô đính kèm tài liệu.
4. Bấm **Publish release**.
5. Bạn sẽ có ngay một link tải file `.zip` trực tiếp máy chủ Microsoft/GitHub tốc độ cực nhanh và vĩnh viễn miễn phí để gửi cho khách hàng!

---

## PHẦN 3: CÁCH DUYỆT VÀ BÁN GÓI 5K/ACC HOẠT ĐỘNG THẾ NÀO?

### Quy trình bán hàng tự động & bán tự động:
1. **Khách dùng thử miễn phí**:
   - Khách tải tiện ích về dùng. Tiện ích cho phép lưu tối đa **2 tài khoản Facebook/TikTok/Shopee** hoàn toàn miễn phí.
   - Trải nghiệm chuyển tab siêu mượt, chống checkpoint cực ngon.

2. **Khi khách thêm tài khoản thứ 3**:
   - Hệ thống tự động chặn và bật bảng thông báo **💎 GIỚI HẠN GÓI MIỄN PHÍ**.
   - Bảng này hiển thị mã QR Techcombank của bạn, ghi rõ:
     - 3 acc (+1): 5.000đ
     - 5 acc (+3): 15.000đ
     - 10 acc (+8): 40.000đ
     - Khách tự chọn số acc tùy ý (hệ thống tự nhân 5k/acc).
   - Nội dung chuyển khoản tự động kèm Mã Thiết Bị (`OMNEI [MachineID] [SốAcc]ACC`).

3. **Khách chuyển tiền & bấm xác nhận**:
   - Khách quét app ngân hàng Techcombank chuyển tiền.
   - Bấm nút **"✅ Tôi Đã Chuyển Khoản - Gửi Xác Nhận Cho Admin"**.
   - Màn hình hiện **Mã Yêu Cầu** (ví dụ: `REQ-OMN-4B82-9F1A-10ACC-XXXX`).
   - Khách bấm nút gửi qua Zalo/Telegram cho bạn.
   *(Nếu bạn cấu hình Telegram Bot của bạn trong Tab Cài Đặt, bot sẽ tự động ting ting báo về điện thoại của bạn ngay lập tức!)*

4. **Bạn (Admin) duyệt trong 3 giây**:
   - Bạn mở file `admin-license.html` trên máy tính hoặc điện thoại.
   - Dán mã của khách vào, bấm **"DUYỆT & TẠO KEY"**.
   - Bấm **"Copy Tin Nhắn Gửi Khách"** gửi lại cho khách.
   - Khách dán key vào tab **💎 Bản Quyền** -> Bấm Kích Hoạt -> Mở khóa ngay lập tức!

> **💡 Lưu ý bảo mật:** Key được sinh ra bằng mã hóa SHA-256 khóa cứng theo Mã Thiết Bị (`Machine ID`) của khách. Khách không thể gửi key đó cho bạn bè hay máy khác dùng chung được!

---

## PHẦN 4: BẢO VỆ MÃ NGUỒN CHỐNG BẺ KHÓA (ANTI-REVERSE ENGINEERING)

Khi bạn muốn xuất bản phiên bản mới gửi cho khách:
1. Chạy lệnh:
   ```powershell
   node build_secure_dist.js
   ```
2. Công cụ này sẽ:
   - Dùng **JavaScript Obfuscator** mã hóa toàn bộ chuỗi string, logic tính tiền, logic check license.
   - Nén code thành 1 dòng, vô hiệu hóa console.log (chống bật F12 soi code).
   - Đóng gói toàn bộ vào file `OMNEI-Pro-v5.0-Commercial.zip`.
3. Bạn chỉ gửi file zip này cho khách, tuyệt đối **không gửi thư mục mã nguồn gốc `omnei/`**!

---

## PHẦN 5: CHIẾN LƯỢC TÌM KIẾM 1.000 KHÁCH HÀNG ĐẦU TIÊN (0 ĐỒNG QUẢNG CÁO)

1. **Khách hàng mục tiêu là ai?**
   - Dân chạy quảng cáo Facebook Ads, TikTok Ads, Shopee Ads (cần quản lý nhiều via/clone, nhiều tài khoản quảng cáo).
   - Người bán hàng online (quản lý 5-20 fanpage và tài khoản cá nhân để seeding, trả lời tin nhắn).
   - Dân MMO, Airdrop, Affiliate.

2. **Kênh Marketing 0 đồng hiệu quả nhất:**
   - **TikTok & Facebook Reels / YouTube Shorts**: Quay video màn hình 30-45 giây với tiêu đề thu hút:
     - *"Cách nuôi 10 nick Facebook trên 1 máy tính không bao giờ bị khóa checkpoint (99% người chưa biết)"*
     - *"Tool quản lý tài khoản gọn nhẹ thay thế trình duyệt antidetect nặng nề hàng chục GB"*
     - Trong video demo tính năng check live, đổi nick trong 1 giây, gán proxy riêng cho từng nick.
   - Để link bio hướng dẫn tải miễn phí bản 2 acc.
   - Khách dùng thử 2 acc thấy sướng -> tự khắc nạp 5k/acc để dùng thêm 5-10 acc!

3. **Mô hình Upsell gia tăng doanh thu:**
   - Ban đầu khách mua thêm 3 acc = 15k.
   - Sau 1-2 tuần nuôi nick ổn định, bạn gửi ưu đãi: *"Nâng cấp lên gói VIP Không giới hạn trọn đời chỉ 99k"*.
   - Khách hàng rất dễ chi 99k - 199k cho một công cụ phục vụ kiếm tiền hằng ngày!
