import "./globals.css";

export const metadata = {
  title: "Cipher Thread",
  description: "End-to-end encrypted messaging",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
