import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#0a0d12" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Фон web-оболочки = colors.bg (тёмная тема); светлая подхватывается
// системным prefers-color-scheme — избегает белой вспышки до гидрации.
// Приложение на web перерисует фон само, как только смонтируется ThemeProvider.
const responsiveBackground = `
body {
  background-color: #0a0d12;
}
@media (prefers-color-scheme: light) {
  body {
    background-color: #f4f6f9;
  }
}`;
