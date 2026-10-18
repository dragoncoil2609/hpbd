# Stellar Bloom 🌌

Thiên hà kỷ niệm 3D: ảnh và lời chúc bay quanh một quả cầu sáng. Xoè tay thì nó bung ra thành thiên hà xoắn ốc, nắm tay thì thu lại.

## Tuỳ chỉnh

Mọi nội dung nằm trong [`config.js`](config.js):

- `title`, `subtitle`: tiêu đề và dòng chữ ở màn hình mở đầu
- `photos`: bỏ ảnh vào thư mục `images/` rồi khai báo, ví dụ `["images/1.jpg", "images/2.jpg"]`. Để trống thì web dùng ảnh minh hoạ.
- `wishes`: danh sách lời chúc. Ảnh thứ i khi mở to sẽ hiện lời chúc thứ i.
- `music`: đường dẫn file nhạc, ví dụ `"music/song.mp3"` (tuỳ chọn)

## Điều khiển

| Cử chỉ tay | Tác dụng |
| --- | --- |
| 🖐 Xoè tay | Bung ra thành thiên hà |
| ✊ Nắm tay | Thu lại thành quả cầu |
| Di chuyển tay | Xoay thiên hà |
| Đưa tay lại gần / ra xa camera | Phóng to / thu nhỏ |
| ☝️ Chỉ vào ảnh và giữ khoảng 1 giây | Mở ảnh |
| ✌️ Giơ hai ngón | Hiện một lời chúc |

Dùng chuột hoặc cảm ứng: kéo để xoay, cuộn hoặc chụm 2 ngón để thu phóng, nhấp đúp để bung/thu, chạm vào ảnh để xem lời chúc.

Camera chỉ chạy trên `https://` hoặc `localhost`. GitHub Pages và Vercel đều dùng https nên không cần cấu hình gì thêm.

## Chạy thử trên máy

Đây là web tĩnh, không cần build. Mở bằng một server tĩnh bất kỳ, ví dụ extension Live Server của VS Code. Mở thẳng file `index.html` thì không chạy được vì trình duyệt chặn ES module qua `file://`.

## Deploy

- **GitHub Pages**: push lên GitHub, vào Settings → Pages, chọn nhánh `main` và thư mục `/ (root)`.
- **Vercel**: Import repo trên vercel.com, Framework Preset chọn **Other**, không cần build command.
