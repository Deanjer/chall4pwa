import express from "express";
import { Server } from "socket.io";
import fs from "fs";

const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log("Server running on port: 3000");
});
const io = new Server(server);

const sockets = [];
const users = [];
const messages = [];

const filterJson = JSON.parse(fs.readFileSync("filter.json"));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.redirect("login");
});

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/users", (req, res) => {
    res.render("users");
  });
app.post("/login", (req, res) => {
  res.redirect(`/chat/${req.body.username}`);
});

app.get("/chat/:username", (req, res) => {
  res.render("chat", { username: req.params.username });
});

const messageCooldown = 1000; 
const lastMessageTime = {};

io.on("connection", (socket) => {
    sockets[socket.id] = socket;
  
    socket.on("join", (username) => {
      const filteredUsername = filterMessage(username);
      users[socket.id] = filteredUsername;
      io.emit("join", { username: filteredUsername, users: Object.values(users) });
    });
  
    socket.on("disconnect", (reason) => {
      const username = users[socket.id];
      delete sockets[socket.id];
      delete users[socket.id];
      io.emit("join", { username: username, users: Object.values(users) });
    });

    socket.on("message", (data) => {
        const { messenger, message } = data;
        const currentTime = new Date().getTime();
        const lastTime = lastMessageTime[socket.id] || 0;
    
        if (currentTime - lastTime < messageCooldown) {
          const remainingCooldown = Math.ceil((messageCooldown - (currentTime - lastTime)) / 1000);
          socket.emit("cooldown", remainingCooldown); 
    
          socket.emit("systemMessage", {
            messenger: "System",
            message: `Cooldown: You can send messages again in ${remainingCooldown} seconds.`,
          });
        } else {
          const filteredMessage = filterMessage(message);
          io.emit("message", { messenger: messenger, message: filteredMessage });
    
          lastMessageTime[socket.id] = currentTime;
        }
      });
    });
  

  
  function filterMessage(input) {
    let filteredInput = input.toLowerCase();
    filterJson.swear_words.forEach((swearWord) => {
      const regex = new RegExp(`\\b${swearWord}\\b`, "gi");
      filteredInput = filteredInput.replace(regex, filterJson.replacement);
    });
    return filteredInput;
  }