require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://tutors-point.netlify.app"],
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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // Database and collections sections
    const userCollection = client.db("tutorsDB").collection("users");
    const sessionCollection = client.db("tutorsDB").collection("sessions");
    const materialsCollection = client.db("tutorsDB").collection("materials");
    const bookedSessionsCollection = client.db("tutorsDB").collection("booked");
    const reviewsCollection = client.db("tutorsDB").collection("reviews");
    const notesCollection = client.db("tutorsDB").collection("notes");

    // Middleware for  admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user.role !== "admin")
        return res.status(403).send({ message: "Access denied! Admin only." });
      next();
    };

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

    // Notes Management APIs:-->
    app.post("/notes", async (req, res) => {
      const data = req.body;
      const result = await notesCollection.insertOne(data);
      res.send(result);
    });

    app.get("/notes/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await notesCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/notes/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await notesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Note deleted successfully!" });
        } else {
          res.status(404).json({ message: "Note not found!" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete the note." });
      }
    });

    // Route to update a note
    app.put("/notes/:id", async (req, res) => {
      const id = req.params.id;
      const { title, description } = req.body;

      try {
        const result = await notesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { title, description } }
        );

        if (result.matchedCount === 1) {
          res.status(200).json({ message: "Note updated successfully!" });
        } else {
          res.status(404).json({ message: "Note not found!" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update the note." });
      }
    });

    // Collecting Materials...:-->

    app.post("/get-session-details", async (req, res) => {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required." });
      }

      // Fetch session details from your database
      const sessionDetails = await sessionCollection.findOne({
        _id: new ObjectId(sessionId),
      });

      if (!sessionDetails) {
        return res.status(404).json({ error: "Session not found." });
      }

      // Generate Stripe Payment Intent (example code)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: sessionDetails.registrationFee * 100, // Convert to cents
        currency: "usd",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        sessionDetails,
      });
    });

    // Session Management APIs:-->
    app.get("/sessions", async (req, res) => {
      const result = await sessionCollection.find().toArray();
      res.send(result);
    });

    app.get("/homeSessions", async (req, res) => {
      try {
        // Query the database for approved sessions and limit the results to 6
        const approvedSessions = await sessionCollection
          .find({ status: "approved" }) // Filter for status: "approved"
          .limit(6) // Limit to 6 items
          .toArray(); // Convert to an array

        // Send the result as a response
        res.status(200).send(approvedSessions);
      } catch (error) {
        // Handle errors
        console.error("Error fetching sessions:", error);
        res.status(500).send({ error: "Failed to fetch sessions" });
      }
    });
    app.get("/approvedSessions", async (req, res) => {
      try {
        // Query the database for approved sessions and limit the results to 6
        const approvedSessions = await sessionCollection
          .find({ status: "approved" })
          .toArray();

        // Send the result as a response
        res.status(200).send(approvedSessions);
      } catch (error) {
        // Handle errors
        console.error("Error fetching sessions:", error);
        res.status(500).send({ error: "Failed to fetch sessions" });
      }
    });

    app.get("/session/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const session = await sessionCollection.findOne(query);
      res.send(session);
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

    // Booked Session Management APIs-->
    app.get("/booked-sessions/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await bookedSessionsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/sessionDetails/:id", async (req, res) => {
      const { id } = req.params;

      try {
        // Convert the id to ObjectId
        const query = { _id: new ObjectId(id) };
        const sessionDetails = await sessionCollection.findOne(query);
        if (!sessionDetails) {
          return res.status(404).send({ message: "Session not found." });
        }

        res.send(sessionDetails);
      } catch (error) {
        console.error("Error fetching session details:", error);
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.post("/book-session", async (req, res) => {
      const { sessionId, studentEmail, registrationFee, tutorEmail } = req.body;

      try {
        const session = await sessionCollection.findOne({
          _id: new ObjectId(sessionId),
        });

        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const result = await bookedSessionsCollection.insertOne({
          sessionId,
          studentEmail,
          tutorEmail,
          registrationFee,
          status: "Booked",
          bookedAt: new Date(),
        });

        if (result.insertedId) {
          return res.status(200).json({
            message: "Booking added successfully!",
            insertedId: result.insertedId,
          });
        } else {
          return res.status(500).json({
            error: "Failed to insert booking data into the database.",
          });
        }
      } catch (error) {
        console.error("Error in /book-session:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Review Management APIs:-->

    app.get("/reviews/:sessionId", async (req, res) => {
      try {
        const { sessionId } = req.params;
        const reviews = await reviewsCollection.find({ sessionId }).toArray();
        res.json(reviews);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch reviews" });
      }
    });

    // Endpoint to submit a review
    app.post("/reviews", async (req, res) => {
      try {
        const { sessionId, reviewText, rating, studentId } = req.body;

        // Validate that required fields are present
        if (!sessionId || !reviewText || !rating) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const review = {
          sessionId,
          studentId: studentId || "Anonymous", // Set default studentId if not provided
          reviewText,
          rating,
          timestamp: new Date(),
        };

        await reviewsCollection.insertOne(review);
        res.status(201).json(review);
      } catch (error) {
        console.error(error); // Log the error to the console for debugging
        res.status(500).json({ error: "Failed to save review" });
      }
    });

    // Material Management APIs:-->
    app.get("/materials", async (req, res) => {
      const result = await materialsCollection.find().toArray();
      res.send(result);
    });

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

    app.get("/materials/:email", async (req, res) => {
      const email = req.params.email;
      const query = { tutorEmail: email };

      try {
        const result = await materialsCollection.find(query).toArray();
        if (result.length === 0) {
          return res
            .status(404)
            .json({ message: "No materials found for this tutor." });
        }
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching materials:", error);
        res.status(500).json({ error: "Failed to fetch materials." });
      }
    });

    app.patch("/materials/:id", async (req, res) => {
      const id = req.params.id;
      const { title, driveLink, image } = req.body;

      const updateData = {};
      if (title) updateData.title = title;
      if (driveLink) updateData.driveLink = driveLink;
      if (image) updateData.image = image;

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating material:", error);
        res.status(500).send({ error: "Failed to update material." });
      }
    });

    app.delete("/materials/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid material ID" });
      }

      try {
        const result = await materialsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Material not found" });
        }

        res.status(200).json({ message: "Material deleted successfully" });
      } catch (error) {
        console.error("Error deleting material:", error);
        res.status(500).json({ error: "Failed to delete material." });
      }
    });
    app.get("/booked-session/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      try {
        const query = { sessionId: new ObjectId(id) }; // Adjust for MongoDB ObjectId
        const session = await materialsCollection.find(query).toArray();
        console.log(session);
        if (!session) {
          return res.status(404).send({ message: "Session not found." });
        }
        res.status(200).send(session);
      } catch (error) {
        console.error("Error fetching booked session:", error);
        res.status(500).send({ error: "Failed to fetch booked session." });
      }
    });

    app.delete("/material/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/materialDetails/:id", async (req, res) => {
      const { id } = req.params;

      try {
        // Query with `sessionId` as a string (do not convert it to ObjectId)
        const query = { sessionId: id };
        const materials = await materialsCollection.find(query).toArray();

        if (!materials.length) {
          return res
            .status(404)
            .send({ message: "No materials found for this session." });
        }

        res.send(materials);
      } catch (error) {
        console.error("Error fetching session details:", error);
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.get("/materials/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const query = { tutorEmail: email };
        const materials = await materialsCollection.find(query).toArray();
        if (!materials.length) {
          return res
            .status(404)
            .json({ message: "No materials found for this tutor." });
        }
        res.status(200).send(materials);
      } catch (error) {
        console.error("Error fetching materials:", error);
        res.status(500).json({ error: "Failed to fetch materials." });
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

    app.get("/tutors", async (req, res) => {
      const query = { role: "tutor" };
      const result = await userCollection.find(query).toArray();
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
