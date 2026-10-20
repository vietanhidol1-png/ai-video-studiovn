# AI Video Studio (bản MVP)

Công cụ dựng video chạy hoàn toàn trên trình duyệt, dùng HTML, CSS và JavaScript thuần. Không backend, không API key, không tốn phí.

## Tính năng hoạt động thật
- Tải lên ảnh (JPG, PNG, WebP), video nền (MP4, WebM) và âm thanh (MP3, WAV...).
- Chọn tỷ lệ 16:9, 9:16, 1:1; chỉnh màu nền, cách đặt hình vào khung.
- Phụ đề **cơ bản (tĩnh)**: kịch bản được chia câu và trải đều theo độ dài chữ. Không nhận diện lời nói nên có thể lệch so với âm thanh.
- Xem trước, tạm dừng, về đầu, thanh tiến trình.
- Xuất video bằng MediaRecorder: ưu tiên WebM, dùng MP4 nếu trình duyệt (như Safari) ghi được trực tiếp.
- Đọc thử kịch bản bằng giọng có sẵn của thiết bị (SpeechSynthesis).

## Không có trong bản này
- Tạo video AI, avatar biết nói, đồng bộ khẩu hình.
- Thu giọng đọc thử vào video (trình duyệt không cho). Muốn có tiếng, hãy tải file âm thanh.
- Phụ đề tự khớp chính xác với lời nói.
- Tiếng gốc của video nền không được đưa vào file xuất.

Ứng dụng chỉ ghép tài nguyên bạn cung cấp, **không phải công cụ tạo video AI**. Các tính năng AI cần mô hình chạy cục bộ hoặc dịch vụ bên ngoài.

## Cách dùng
1. Nhập kịch bản. 2. Tải ảnh/video và âm thanh. 3. Chỉnh tỷ lệ, phụ đề. 4. Bấm **Xuất video**, giữ tab mở đến khi chạy xong (video được ghi theo thời gian thực, nên 1 phút video mất 1 phút), rồi bấm **Tải video xuống**.

Đổi WebM sang MP4: mở bằng VLC, hoặc dùng HandBrake / CloudConvert (miễn phí).

## Đưa lên GitHub Pages
1. Tạo tài khoản và repository mới trên github.com (ví dụ `ai-video-studio`, chế độ Public).
2. Bấm **Add file → Upload files**, kéo thả 4 file `index.html`, `style.css`, `app.js`, `README.md` vào, rồi **Commit changes**.
3. Vào **Settings → Pages**.
4. Ở mục **Build and deployment**, chọn **Source: Deploy from a branch**, chọn nhánh **main** và thư mục **/(root)**, bấm **Save**.
5. Đợi 1–2 phút, địa chỉ site hiện ở đầu trang Pages: `https://<tên-bạn>.github.io/ai-video-studio/`.

Hoặc chạy thử ngay: mở `index.html` bằng Chrome/Edge, không cần server.

## Trình duyệt khuyến nghị
Chrome, Edge, Firefox bản mới trên máy tính. Trên điện thoại, việc xuất video phụ thuộc trình duyệt và có thể không hoạt động.
