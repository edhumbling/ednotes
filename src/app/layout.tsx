import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ed's Notes",
  description: "A simple, elegant notes app",
  manifest: "/manifest.json",
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
      <body suppressHydrationWarning>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered');
                  }, function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
