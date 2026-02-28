console.log("SERVER FILE LOADED");

import app from "./app";

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
});