// ==========================================================
//  CHỈNH SỬA NỘI DUNG Ở ĐÂY
// ==========================================================
export default {
  // Tiêu đề hiện ở màn hình mở đầu và góc trên
  title: "Stellar Bloom",
  subtitle: "Gửi những điều dịu dàng nhất đến em ♡",

  // Danh sách ảnh. Bỏ ảnh vào thư mục images/ rồi ghi tên file vào đây, ví dụ:
  //   photos: ["images/1.jpg", "images/2.jpg", "images/3.png"],
  // Để trống [] thì web dùng ảnh minh hoạ tự vẽ.
  photos: Array.from({ length: 25 }, (_, i) => `images/${i + 1}.jpg`),

  // Số ảnh minh hoạ khi chưa có ảnh thật
  placeholderCount: 24,

  // Những lời chúc bay quanh thiên hà (ảnh thứ i dùng lời chúc thứ i khi mở to)
  wishes: [
    "Công chúa của anh xinh nhất trên đời",
    "Yêu vợ nhất thế giớiii ♡",
    "Ngày ra đời của một thiên thần",
    "Luôn yêu em như ngày đầu tiên",
    "Thương vợ ♡",
    "Em là điều tuyệt vời nhất của anh",
    "Cảm ơn em đã đến bên anh",
    "Cả thiên hà này cũng không đẹp bằng em",
    "Mãi là cô gái nhỏ của anh nhé",
    "Anh yêu em nhiều lắm ♡",
  ],

  // Nhạc nền:
  //   "builtin"          bản Happy Birthday hộp nhạc ngọt ngào, tự phát bằng trình duyệt (không cần file)
  //   "music/song.mp3"   dùng file nhạc riêng (bỏ file vào thư mục music/)
  //   ""                 tắt nhạc
  music: "music/cho-chut.mp3",

  // Giây bắt đầu phát bài hát (ví dụ 45 để vào thẳng điệp khúc)
  musicStart: 0,
};
