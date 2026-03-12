import type { AppProps } from "next/app";
import "click-to-source/next-init";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
