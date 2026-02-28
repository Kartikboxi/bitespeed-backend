console.log("SERVER FILE LOADED");

import app from "./app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
});