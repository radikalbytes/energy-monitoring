import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Head>
        <title>Voltio · Monitor de energía en tiempo real</title>
        <meta name="description" content="Consumo, coste y confort de tu hogar en tiempo real." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4f46e5" />
      </Head>
      <div className={inter.className}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
