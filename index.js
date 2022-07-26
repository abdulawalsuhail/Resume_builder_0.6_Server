const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_API_KEY);
const socket = require("socket.io");

// password database:
const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.RESUME_BUILDER}:${process.env.RESUME_BUILDER_PASS}@cluster0.ozvnhci.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// verify jwt function //
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorize access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    if (decoded) {
      req.decoded = decoded;
      next();
    }
  });
};

// backend all code //
async function run() {
  try {
    await client.connect();
    console.log("db-connect");

    // collection
    const resumeBuilderUsersCollection = client
      .db("Resume_Builder")
      .collection("users");
    const resumeBuilderResumeCollection = client
      .db("Resume_Builder")
      .collection("resume-collection");
    const resumeBuilderService = client
      .db("Resume_Builder")
      .collection("Services");

    const resumeBuilderServiceBooking = client
      .db("Resume_Builder")
      .collection("booking");
    const resumeBuilderUserReview = client
      .db("Resume_Builder")
      .collection("review");
    const resumeBuilderBlog = client.db("Resume_Builder").collection("Blog");

    const coverLetterInfoCollection = client
      .db("coverLetterInfo")
      .collection("CL_info");
    const resumeBuilderAdminMessage = client
      .db("Resume_Builder")
      .collection("message");
    const resumeBuilderAdminChat = client
      .db("Resume_Builder")
      .collection("chat");
    const quizCollection = client.db("quiz").collection("quizQuestion");
    const quizMarksCollection = client.db("quiz").collection("quizMarks");

    // const verify admin
    const verifyAdmin = async (req, res, next) => {
      const decoded = req.decoded.email;
      const filter = { email: decoded };
      const admin = await resumeBuilderUsersCollection.findOne(filter);
      if (admin.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    };

    /*  Shariar api*/

    app.get("/conversationuser/:id", async (req, res) => {
      const userId = { _id: ObjectId(req.params.id) };
      const user = await resumeBuilderUsersCollection.findOne(userId);
      res.json(user);
    });

    // get message
    app.get("/message/:chatId", async (req, res) => {
      const { chatId } = req.params;
      const getMessage = await resumeBuilderAdminMessage
        .find({
          chatId,
        })
        .toArray();
      res.json(getMessage);
    });
    // post message
    app.post("/message", async (req, res) => {
      const { chatId, senderId, text } = req.body;
      const sendMessage = await resumeBuilderAdminMessage.insertOne({
        chatId,
        senderId,
        text,
      });
      res.json(sendMessage);
    });
    // admin chat single api

    app.get("/admin/chat/find/:firstId/:secondId", async (req, res) => {
      const result = await resumeBuilderAdminChat.findOne({
        members: { $all: [req.params.firstId, req.params.secondId] },
      });
      res.json(result);
    });
    // admin chat get api

    app.get("/admin/chat/:id", async (req, res) => {
      const result = await resumeBuilderAdminChat
        .find({
          members: { $in: [req.params.id] },
        })
        .toArray();
      res.json(result);
    });
    // post admin chat
    app.post("/admin/chat", async (req, res) => {
      const senderId = req.body.senderId;
      const receiverId = req.body.receiverId;
      const result = await resumeBuilderAdminChat.insertOne({
        members: [senderId, receiverId],
      });
      res.send(result);
    });

    //   const from = req.params.id
    //   const to = req.query.to
    //   const messages = await resumeBuilderAdminMessage.find({
    //     users:{
    //       $all:[from,to]
    //     }
    //   }).toArray()
    //   const projectedMessages = messages.map((msg) => {
    //     return {
    //       fromSelf: msg.sender.toString() === from,
    //       message: msg.message.text
    //     };
    //   });
    //   res.json(projectedMessages);
    // })
    // message post api

    // app.post('/messages',async (req,res) => {
    //   const {from,to,message} = req.body
    //   console.log(from.to,message);
    //   const result = await resumeBuilderAdminMessage.insertOne({
    //     message:{text:message},
    //     users:[from,to],
    //     sender:from,
    //     createdAt:Date.now()
    //   })
    //   res.send(result)
    // })

    // put like id

    app.put("/like/:userId", verifyJwt, async (req, res) => {
      const userFilter = { _id: ObjectId(req.params.userId) };
      const user = await resumeBuilderUsersCollection.findOne(userFilter);
      const userId = user?._id;
      const id = req.body.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = { $push: { likes: userId } };
      const result = await resumeBuilderBlog.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // unlike
    app.put("/unlike/:userId", verifyJwt, async (req, res) => {
      const userFilter = { _id: ObjectId(req.params.userId) };
      const user = await resumeBuilderUsersCollection.findOne(userFilter);
      const userId = user?._id;
      const id = req.body.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = { $pull: { likes: userId } };
      const result = await resumeBuilderBlog.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // paid status by single id

    app.patch("/paidstatus/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
        },
      };
      const result = await resumeBuilderServiceBooking.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    // single user
    app.get("/single/user/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const result = await resumeBuilderUsersCollection.findOne({
        email: email,
      });
      res.send(result);
    });

    // get single user. without verify jwt
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await resumeBuilderUsersCollection.findOne({
        email: email,
      });
      res.send(result);
    });

    // user profile updated
    app.patch("/profile/update/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const updateProfile = req.body;
      const filter = { email: email };
      const updatedDoc = {
        $set: updateProfile,
      };
      const result = await resumeBuilderUsersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
    // user photo  upload and updated
    app.patch("/user/image/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const img = req.body;
      const filter = { email: email };
      const updatedDoc = {
        $set: img,
      };

      const result = await resumeBuilderUsersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    // all blogs
    app.get("/all-blog", async (req, res) => {
      const filter = req.query;
      if (filter === filter) {
        const resume = await (
          await resumeBuilderBlog.find(filter).toArray()
        ).reverse();
        return res.send(resume);
      }
      const result = await (await resumeBuilderBlog.find().toArray()).reverse();
      res.send(result);
    });
    // edit blog post
    app.patch("/blog/:id", verifyJwt, async (req, res) => {
      const updateBlog = req.body;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: updateBlog,
      };

      const result = await resumeBuilderBlog.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // single blog post
    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await resumeBuilderBlog.findOne(filter);
      res.send(result);
    });

    // delete blog post

    app.delete("/blogs/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await resumeBuilderBlog.deleteOne(filter);
      res.send(result);
    });

    // blog post query by email

    app.get("/blogs/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const result = await resumeBuilderBlog.find({ email: email }).toArray();
      res.send(result);
    });

    // Blog api
    app.post("/blogs", verifyJwt, async (req, res) => {
      const blog = req.body;
      const result = await resumeBuilderBlog.insertOne(blog);
      res.send(result);
    });

    // all review api

    app.get("/reviews", async (req, res) => {
      const result = await (
        await resumeBuilderUserReview.find().toArray()
      ).reverse();
      res.send(result);
    });

    // Review post api
    app.post("/reviews", verifyJwt, async (req, res) => {
      const review = req.body;
      const result = await resumeBuilderUserReview.insertOne(review);
      res.send(result);
    });
    // user order
    app.get("/order/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const result = await resumeBuilderServiceBooking
        .find({ email: email })
        .toArray();
      res.send(result);
    });
    // remove admin
    app.patch(
      "/remove-admin/:email",
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            role: "",
          },
        };
        const result = await resumeBuilderUsersCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );
    // all admin
    app.get("/admin", verifyJwt, verifyAdmin, async (req, res) => {
      const role = req.query;
      if (role === role) {
        const query = await resumeBuilderUsersCollection.find(role).toArray();
        return res.send(query);
      }
    });
    // secure admin api
    app.get("/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const admin = await resumeBuilderUsersCollection.findOne({
        email: email,
      });
      const isAdmin = admin.role == "admin";
      res.send(isAdmin);
    });
    // create admin
    app.put("/users/admin/:email", verifyJwt, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await resumeBuilderUsersCollection.updateOne(
        query,
        updatedDoc
      );
      res.send(result);
    });
    // secure expert
    app.get("/expert/:email", async (req, res) => {
      const email = req.params.email;
      const expert = await resumeBuilderUsersCollection.findOne({
        email: email,
      });
      const isExpert = expert.writer == "expert";
      res.send(isExpert);
    });
    // remove expert
    app.patch(
      "/remove-expert/:email",
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            writer: "",
          },
        };
        const result = await resumeBuilderUsersCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    // get all expert
    app.get("/expert", verifyJwt, async (req, res) => {
      const writer = req.query;
      if (writer === writer) {
        const query = await resumeBuilderUsersCollection.find(writer).toArray();
        return res.send(query);
      }
    });
    // create expert
    app.put(
      "/users/expert/:email",
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const updatedDoc = {
          $set: {
            writer: "expert",
          },
        };
        const result = await resumeBuilderUsersCollection.updateOne(
          query,
          updatedDoc
        );
        res.send(result);
      }
    );

    // get all user
    app.get("/all-users", verifyJwt, async (req, res) => {
      const email = req.query;
      if (email === email) {
        const query = await resumeBuilderUsersCollection.find(email).toArray();
        return res.send(query);
      }
      const users = await resumeBuilderUsersCollection.find().toArray();
      res.send(users);
    });

    // single service query by id

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await resumeBuilderService.findOne(query);
      res.send(result);
    });

    // get-all-service
    app.get("/services", async (req, res) => {
      const result = await resumeBuilderService.find().toArray();
      res.send(result);
    });

    // booking service
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await resumeBuilderServiceBooking.insertOne(booking);
      res.send(result);
    });

    // get all booking
    app.get("/booking-service", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await resumeBuilderServiceBooking.find().toArray();
      res.send(result);
    });

    // payment api
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const service = req.body;
      const price = service.price;

      if (price) {
        const amount = price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    // post edit-resume information
    app.post("/edit-resume/:email", async (req, res) => {
      const doc = req.body;
      const result = await resumeBuilderResumeCollection.insertOne(doc);
      res.send({ result, message: "success" });
    });

    //  users store on mongoDB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await resumeBuilderUsersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      const token = jwt.sign({ email: email }, process.env.JWT_TOKEN);

      res.send({ result, token, message: "200" });
    });

    // ifty vai api

    // set coverLetter information in database
    app.put("/coverLetterInfo/:email", verifyJwt, async (req, res) => {
      const userEmail = req.params.email;
      const filter = { userEmail };
      const coverLetterInfo = req?.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: coverLetterInfo,
      };
      const result = await coverLetterInfoCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Get coverLetter information
    app.get("/coverLetterInfo/:id", verifyJwt, async (req, res) => {
      const userEmail = req.params.id;
      const query = { userEmail };
      const result = await coverLetterInfoCollection.findOne(query);
      res.send(result);
    });

    // add quiz question
    app.post("/addQuiz", verifyJwt, async (req, res) => {
      const quizQuestion = req?.body;
      const result = await quizCollection.insertOne(quizQuestion);
      res.send(result);
    });

    // get all quiz
    app.get("/quiz", async (req, res) => {
      const result = await quizCollection.find().toArray();
      res.send(result);
    });

    // add quiz answer in database
    app.put("/quiz/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const quizResult = req?.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: quizResult,
      };
      const result = await quizMarksCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // get user quiz result
    app.get("/quizResult/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await quizMarksCollection.findOne(query);
      res.send(result);
    });

    // get quiz result for leader board
    app.get("/quizResult", verifyJwt, async (req, res) => {
      const result = await quizMarksCollection
        .find({})
        .sort({ marks: -1 })
        .limit(20)
        .toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

// server run //

app.get("/", (req, res) => {
  res.send("Resume Builder Server");
});

app.listen(port, () => {
  console.log("Listening to port", port);
});
