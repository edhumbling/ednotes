import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ed's Notes",
  description: "A simple, elegant notes app",
  icons: {
    icon: "https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
