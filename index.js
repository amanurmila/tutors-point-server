// npx nodemon index.js
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "https://career-portal-ph.web.app",
      // "https://career-portal-ph.web.app",
    ], // can be multiple
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// verify token hook / middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = req.headers.authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2fdwk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Database and collections sections
    const userCollection = client.db("tutorsDB").collection("users");

    //. Auth related APIs [JWT token]--//
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    // . ends here              //

    //----------------- All APIs -----------------//

    // User management APIs
    app.post("/users", async (req, res) => {
      const data = req.body;
      const email = data.email;

      if (!email) {
        return res
          .status(400)
          .send({ success: false, message: "Email is required" });
      }

      try {
        // Check if a user with the given email already exists
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          return res
            .status(409) // Conflict HTTP status code
            .send({
              success: false,
              message: "Email already exists in the database",
            });
        }

        // If email is unique, proceed to insert the user
        const result = await userCollection.insertOne(data);
        res.send({ success: true, message: "User added successfully", result });
      } catch (error) {
        console.error("Error inserting user:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal Server Error" });
      }
    });

    app.get("/users", async (req, res) => {
      const data = await userCollection.find().toArray();
      res.send(data);
    });

    //--------------------------------------------//
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Job is falling from the sky");
});

app.listen(port, () => {
  console.log(`Job is waiting at: ${port}`);
});
