This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Generador de datos

El generador necesita una clave válida de AEMET en la variable de entorno `AEMET_API_KEY`:

```bash
cp .env.example .env
# Edita .env y sustituye el valor de ejemplo por tu clave real.
set -a
. ./.env
set +a
npm run dev
# En otra terminal:
python3 python/generador.py
```

Por defecto el generador envía las muestras a `http://localhost:3000/api/data`. Para enviarlas a producción, define `DEST_URL` antes de ejecutarlo.

Si AEMET no responde y no hay valores meteorológicos anteriores, el generador omite esa muestra para respetar los campos obligatorios de la tabla `energy_data`.

En Vercel, añade `AEMET_API_KEY` en **Project Settings > Environment Variables** y vuelve a desplegar el proyecto. Esa variable estará disponible para las funciones de Vercel; si `generador.py` se ejecuta en tu ordenador o en otro servidor, también debes configurarla allí.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
