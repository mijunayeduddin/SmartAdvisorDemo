import './globals.css';

export const metadata = {
  title: 'SmartAdvisor – Course Finder | North South University',
  description: 'Fast, responsive course search and section filter for NSU students (CSE 327)',
  keywords: ['NSU', 'Course Finder', 'Advising', 'CSE327', 'North South University', 'Sections'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
