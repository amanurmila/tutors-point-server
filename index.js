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
    const sessionCollection = client.db("tutorsDB").collection("sessions");
    const materialsCollection = client.db("tutorsDB").collection("materials");

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

    // Session Management APIs:-->
    app.get("/sessions", async (req, res) => {
      const result = await sessionCollection.find().toArray();
      res.send(result);
    });

    app.get("/sessions/:email", async (req, res) => {
      const email = req.params.email;
      const query = { tutorEmail: email };
      const result = await sessionCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/sessions/approved/:email", async (req, res) => {
      const email = req.params.email;

      try {
        // Query to find sessions by tutor's email and with status 'approved'
        const query = { tutorEmail: email, status: "approved" };
        const result = await sessionCollection.find(query).toArray();

        if (result.length === 0) {
          return res
            .status(404)
            .json({ message: "No approved sessions found." });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching approved sessions:", error);
        res.status(500).json({ error: "Failed to fetch approved sessions." });
      }
    });

    app.post("/sessions", async (req, res) => {
      const session = req.body;
      const result = await sessionCollection.insertOne(session);
      res.send(result);
    });

    app.patch("/sessions/approve/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved" } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({ message: "Session approved successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to approve session" });
      }
    });

    app.patch("/sessions/reject/:id", async (req, res) => {
      const { id } = req.params;
      const { rejectionReason, feedback } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "rejected",
              rejectionReason: rejectionReason || "No reason provided",
              feedback: feedback || "",
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({ message: "Session rejected successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to reject session" });
      }
    });

    app.patch("/sessions/:id", async (req, res) => {
      const { id } = req.params;
      const { status, registrationFee } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const existingSession = await sessionCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingSession) {
          return res.status(404).json({ error: "Session not found" });
        }

        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              registrationFee:
                registrationFee !== undefined
                  ? registrationFee
                  : existingSession.registrationFee,
              status: status || existingSession.status, // Retain the existing status if not explicitly provided
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        const updatedSession = await sessionCollection.findOne({
          _id: new ObjectId(id),
        });

        res.status(200).json({
          message: "Session updated successfully",
          session: updatedSession,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update session" });
      }
    });

    app.delete("/sessions/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const result = await sessionCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({ message: "Session deleted successfully" });
      } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
      }
    });

    app.patch("/sessions/reject/:id", async (req, res) => {
      const { id } = req.params;
      const { rejectionReason, feedback } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "rejected",
              rejectionReason: rejectionReason || "No reason provided",
              feedback: feedback || "",
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({ message: "Session rejected successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to reject session" });
      }
    });

    app.patch("/sessions/status/:id", async (req, res) => {
      const { id } = req.params;
      const { status, rejectionReason, feedback } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const updateFields = { status };
      if (status === "rejected") {
        updateFields.rejectionReason = rejectionReason || "No reason provided";
        updateFields.feedback = feedback || "";
      }

      try {
        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({ message: "Session status updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update session status" });
      }
    });

    app.patch("/sessions/statusChange/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      try {
        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } } // Update only the status
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Session not found" });
        }

        res
          .status(200)
          .json({ message: "Session status updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update session status" });
      }
    });

    // Material Management APIs-->
    app.post("/materials", async (req, res) => {
      const material = req.body;

      try {
        const result = await materialsCollection.insertOne(material);
        res.status(201).json({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error saving material:", error);
        res.status(500).json({ error: "Failed to save material." });
      }
    });

    // User Management APIs:-->
    app.get("/users", async (req, res) => {
      const { search } = req.query;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        };
      }

      try {
        const users = await userCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

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

    //--------------------------------------------//
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Tutors is ready to do work...");
});

app.listen(port, () => {
  console.log(`Tutors are waiting at: ${port}`);
});
