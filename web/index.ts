import express, { Request, Response } from "express";

const PORT = 9999;

const app = express();

app.get("*", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.listen(PORT, () => console.log(`Sever has started at port ${PORT}`));
