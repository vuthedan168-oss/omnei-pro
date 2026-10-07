const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, 'omnei');
const DIST_DIR = path.join(__dirname, 'omnei-dist');
const ZIP_OUTPUT = path.join(__dirname, 'OMNEI-Pro-v5.0-Commercial.zip');

console.log('🚀 Bắt đầu quy trình đóng gói & mã hóa bảo vệ OMNEI Pro...');

// 1. Dọn dẹp thư mục dist cũ
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Sao chép toàn bộ tài nguyên tĩnh (Images, HTML, CSS, Manifest, jQuery)
const files = fs.readdirSync(SRC_DIR);
for (const file of files) {
    const srcPath = path.join(SRC_DIR, file);
    const destPath = path.join(DIST_DIR, file);

    if (fs.lstatSync(srcPath).isDirectory()) continue;

    // Chỉ sao chép trực tiếp các file không cần obfuscate
    if (!file.endsWith('.js') || file === 'jquery.min.js') {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  [Copy] ${file}`);
    }
}

// 3. Danh sách các file JavaScript độc quyền cần MÃ HÓA & OBFUSCATE
const jsFilesToProtect = [
    'crypto-utils.js',
    'omnei-shield.js',
    'timuid.js',
    'background.js',
    'popup.js'
];

console.log('\n🔒 Đang mã hóa chống dịch ngược (Obfuscating & Hardening Code)...');

for (const jsFile of jsFilesToProtect) {
    const inputPath = path.join(SRC_DIR, jsFile);
    const outputPath = path.join(DIST_DIR, jsFile);

    if (!fs.existsSync(inputPath)) continue;

    console.log(`  [Encrypting] ${jsFile}...`);

    // Chạy javascript-obfuscator với cấu hình chuẩn an toàn Manifest V3
    // - string-array mã hóa base64 chống đọc trộm chuỗi
    // - compact nén code 1 dòng
    // - rename-globals false để giữ nguyên Chrome Extension API
    // - disable-console-output true để hacker không xem được log F12
    const cmd = `npx -y javascript-obfuscator "${inputPath}" ` +
        `--output "${outputPath}" ` +
        `--compact true ` +
        `--target browser-no-eval ` +
        `--rename-globals false ` +
        `--string-array true ` +
        `--string-array-encoding base64 ` +
        `--string-array-threshold 0.8 ` +
        `--split-strings true ` +
        `--split-strings-chunk-length 5 ` +
        `--transform-object-keys false ` +
        `--disable-console-output true`;

    try {
        execSync(cmd, { stdio: 'pipe' });
        const originalSize = fs.statSync(inputPath).size;
        const obfuscatedSize = fs.statSync(outputPath).size;
        console.log(`    ✅ Đã bảo vệ thành công: ${(originalSize / 1024).toFixed(1)} KB -> ${(obfuscatedSize / 1024).toFixed(1)} KB`);
    } catch (err) {
        console.error(`    ❌ Lỗi khi mã hóa ${jsFile}:`, err.message);
        // Fallback copy if error
        fs.copyFileSync(inputPath, outputPath);
    }
}

// 4. Tạo file ZIP phân phối sẵn sàng gửi cho khách hàng
console.log('\n📦 Đang nén thành file ZIP phân phối...');
try {
    const psCmd = `powershell -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${ZIP_OUTPUT}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
    console.log(`✅ File nén thương mại hoàn tất: ${ZIP_OUTPUT}`);
} catch (e) {
    console.warn('Cảnh báo nén zip:', e.message);
}

console.log('\n🎉 HOÀN TẤT ĐÓNG GÓI BẢO VỆ OMNEI PRO THƯƠNG MẠI!');
