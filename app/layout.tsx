import "./globals.css";

export const metadata = {
  title: "WhatsApp Outreach MVP",
  description: "Approval-gated WhatsApp sales outreach host app"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
