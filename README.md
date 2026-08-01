# Cờ Tướng — Xiangqi Web Game

Game cờ tướng chạy hoàn toàn trên trình duyệt, không cần backend.

## Cấu trúc file

| File | Nội dung |
|---|---|
| `index.html` | Khung trang, liên kết CSS/JS/config |
| `style.css` | Toàn bộ giao diện (bàn cờ gỗ, quân pha lê, animation...) |
| `script.js` | Luật chơi, AI (minimax + alpha-beta), lưu/tải file, chơi từ xa qua file, chế độ gian lận |
| `config.json` | Dữ liệu bàn cờ: kích thước, vị trí xếp quân ban đầu, giá trị quân (cho AI), ký tự quân cờ |

## Chạy thử

`script.js` tải `config.json` bằng `fetch()`, nên **không thể mở `index.html` trực tiếp bằng cách double-click** (trình duyệt chặn fetch trên `file://`). Hãy chạy qua một server tĩnh, ví dụ:

```bash
npx serve .
# hoặc
python3 -m http.server 8000
```

rồi mở `http://localhost:PORT`.

## Deploy lên GitHub Pages

1. Đẩy 4 file trên lên một repo.
2. Vào **Settings → Pages**, chọn branch `main`, thư mục `/ (root)`.
3. Đợi vài phút, trang sẽ có sẵn tại `https://<username>.github.io/<repo>/`.

## Tính năng

- Luật cờ tướng đầy đủ (kể cả "lộ mặt tướng", cản chân Mã, mắt Tượng, ăn qua ngòi của Pháo).
- Chơi 2 người cùng máy, hoặc đấu AI (2 mức độ).
- Lưu/tải ván đấu ra file `.json`.
- Chơi từ xa với bạn bè bằng cách trao đổi file lượt đi (không cần server).
- Chế độ gian lận khi đấu máy (đổi lượt, tiêu diệt tức thì, trảm tướng, hồi sinh quân).

## Chơi từ xa

- **Trực tiếp (P2P, WebRTC)**: thời gian thực, không cần server hay tài khoản. Người tạo phòng bấm "Tạo phòng (Host)", gửi mã mời (chuỗi base64) cho đối thủ qua chat; đối thủ dán mã đó vào ô "Vào phòng (Guest)" rồi gửi lại mã trả lời; host dán mã trả lời và bấm "Kết nối". Sau khi kết nối, mọi nước đi tự động đồng bộ ngay lập tức qua kênh dữ liệu WebRTC (chỉ dùng STUN server công khai của Google/Twilio để dò NAT — có thể thất bại trên mạng công ty/4G chặn UDP, khi đó hãy dùng cách "Qua file" bên dưới).
- **Qua file**: không thời gian thực, nhưng luôn hoạt động ở mọi mạng. Mỗi lượt xuất ra 1 file `.json` nhỏ và gửi qua lại.
