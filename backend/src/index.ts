import { createApp } from './app';

const port = process.env.PORT ?? 3001;
createApp().listen(port, () => {
  console.log(`kakeibo backend listening on port ${port}`);
});
