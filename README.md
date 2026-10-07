# 🚀 OMNEI Pro - Ultimate Multi-Session & Antidetect Manager (Commercial Edition)

Nền tảng mở rộng Chrome Extension chuyên nghiệp quản lý đa tài khoản mạng xã hội (Facebook, TikTok, Shopee, X/Twitter), bảo vệ vân tay Antidetect mini chống checkpoint, Live/Die Checker tự động và phân phối theo mô hình thương mại hóa SaaS.

---

## 💎 Mô Hình Thương Mại Hóa (Pricing & Monetization)

- **Gói Miễn Phí (FREE STARTER)**:
  - Cho phép quản lý tối đa **2 tài khoản** miễn phí trọn đời.
  - Phù hợp cho người dùng mới trải nghiệm tốc độ và tính năng antidetect.

- **Gói Mở Rộng / Trả Phí**:
  - Từ **3 tài khoản trở lên**: **5.000 VNĐ / 1 tài khoản**.
  - Ví dụ:
    - Gói 3 tài khoản: `5.000 VNĐ`
    - Gói 5 tài khoản: `15.000 VNĐ`
    - Gói 10 tài khoản: `40.000 VNĐ`
    - Gói 20 tài khoản: `90.000 VNĐ`
    - Gói VIP Không giới hạn: `99.000 VNĐ`
  - Thanh toán tiện lợi qua **Techcombank VietQR 24/7**.
  - Tự động sinh mã yêu cầu nâng cấp (`REQ-OMN-...`).
  - Chủ phần mềm (Admin) duyệt và cấp key kích hoạt chỉ trong 3 giây bằng bộ công cụ `admin-license.html`.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
codevip/
├── omnei/                       # Thư mục mã nguồn gốc Extension
│   ├── manifest.json            # Cấu hình Manifest V3
│   ├── background.js            # Service worker xử lý ngầm, giới hạn tài khoản
│   ├── popup.html               # Giao diện chính, VietQR Techcombank, Bảng giá
│   ├── popup.js                 # Logic điều khiển, quota checker, thanh toán
│   ├── popup.css                # Giao diện Cyberpunk Glassmorphic sang trọng
│   ├── crypto-utils.js          # Động cơ mật mã AES-GCM, sinh & xác minh license
│   ├── omnei-shield.js          # In-browser Canvas/WebGL/WebRTC fingerprint mask
│   └── qr_payment.png           # Mã QR thanh toán Techcombank VietQR
│
├── admin-license.html           # 👑 Giao diện Quản trị viên (Admin Approval Panel)
├── build_secure_dist.js         # Script nén & mã hóa bảo vệ chống dịch ngược (Obfuscator)
├── omnei-dist/                  # Thư mục bản dựng sau khi mã hóa bảo vệ (đã sẵn sàng cài)
├── OMNEI-Pro-v5.0-Commercial.zip# File nén phân phối gửi khách hàng
├── THUONG_MAI_HOA_HUONG_DAN.md  # Cẩm nang thương mại hóa 100% MIỄN PHÍ
└── README.md
```

---

## 🛠️ Hướng Dẫn Cài Đặt Cho Khách Hàng

1. Tải về file `OMNEI-Pro-v5.0-Commercial.zip` và giải nén ra một thư mục trên máy tính.
2. Mở trình duyệt Chrome / Cốc Cốc / Edge / Brave.
3. Truy cập địa chỉ: `chrome://extensions/`
4. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
5. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)** và chọn thư mục `omnei-dist` (hoặc thư mục đã giải nén).
6. Ghim biểu tượng OMNEI lên thanh tiện ích để sử dụng.

---

## 👑 Dành Cho Chủ Phần Mềm (Admin Approval)

Khi khách hàng chuyển khoản 5k/acc vào QR Techcombank và bấm **"Tôi đã chuyển khoản"**:
1. Khách gửi cho bạn **Mã Yêu Cầu** (ví dụ: `REQ-OMN-4B82-9F1A-10ACC-XXXX`) hoặc **Machine ID** (`OMN-4B82-9F1A`).
2. Bạn mở file `admin-license.html` trực tiếp trên trình duyệt.
3. Dán mã của khách vào, chọn số acc duyệt (ví dụ 10 Acc), bấm **"DUYỆT & TẠO KEY"**.
4. Bấm nút **"Copy Tin Nhắn Gửi Khách"** và gửi lại cho khách qua Zalo/Telegram/Facebook.
5. Khách dán key vào tab **💎 Bản Quyền** là mở khóa ngay lập tức!
