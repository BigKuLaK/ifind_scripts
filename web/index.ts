// TODO: Implement authentication middleware

import express, { Request, Response } from "express";
import { initializeScripts } from '@scripts';
import { initializeControllers } from '@web/controllers';

const PORT = 9999;

const app = express();

// Initialize selected scripts
initializeScripts();

// Initialize controllers
initializeControllers(app);

// Test route
app.get("/", (req: Request, res: Response) => {
  res.send("IFIND Scripts Works!");
});

// Start server
app.listen(PORT, () => console.log(`Sever has started at port ${PORT}`));
