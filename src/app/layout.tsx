import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "달콤한 꿈나라 🌙 - 맞춤형 AI 잠자리 동화 생성기",
  description: "우리 아이의 이름, 관심사, 부모님의 따뜻한 교훈을 담아 매일 밤 세상에 단 하나뿐인 잠자리 동화를 선물하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}

