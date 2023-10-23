require('dotenv').config();
process.env;

const PORT = process.env.PORT || 4000;
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const User = require("./models/dataSchema");
const Post = require("./models/dataPost");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "/tmp" });
const fs = require("fs");

// parse application/json
app.use(bodyParser.json());

const jsonParser = bodyParser.json();

app.use(express.json());
app.use(cors({origin: ["http://localhost:3000", "https://readers-blog-app.onrender.com"] }));
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

const salt = bcrypt.genSaltSync(10);
const secret = "ajksuiskfbkkfbkd";

// Mongoose Connection
const db = mongoose.connection;
 mongoose.connect(process.env.MONGODB_URL);
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function () {
  console.log("Connected successfully");
});

// Cloudinary
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Register
app.post("/register", jsonParser, async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { username, password } = req.body;

  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (error) {
    res.status(400).json(e);
  }
});

// Login
app.post("/login", async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("Wrong credentials");
  }
});

// Confirm login
app.get("/profile", (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

// Confirm logout
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

//Create post
app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { path } = req.file;
  const result = await cloudinary.uploader.upload(path, {
          folder: 'images',
          upload_preset: "reader_blog",
        });

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: {
        public_id: result.public_id,
        url: result.secure_url
    },
      author: info.id,
    });

    res.json(postDoc);
  });
});


// Update Post
app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
     newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const {id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover.public_id,
    })

    res.json(postDoc);
  });

});

app.get("/post", async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

// DELETE post
app.delete('/delete/:id', async (req, res) => {
  mongoose.connect(process.env.MONGODB_URL);
  const { id } = req.params;
  try {
    const post = await Post.findByIdAndDelete(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    return res.status(200).json({ message: 'Post deleted successfully.' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
