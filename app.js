const net = require("net");
const { stdin } = require("process");

const server = net.createServer();

const dotenv = require("dotenv");
dotenv.config();

let usersLoggedOn = [];

// configurando mongodb
const { MongoClient } = require("mongodb");
const uri =
  "mongodb+srv://houdini23:houdini23@cluster0.ywlnc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// -------------------------------------------------------------------------------

// Exibindo usuários logados
setInterval(showUsersLogged, 30000);
// ----------------------------------------------

const port = 22000;
server.listen(port, () => console.log(`Server listening on port ${port}`));
let userToUpdate = null;

server.on("connection", async (socket, req) => {
  socket.setEncoding("utf8");
  console.log(
    "Conectando usuário " +
      socket.remoteAddress +
      ":" +
      socket.remotePort +
      "..."
  );
  await client.connect();
  usersLoggedOn.push({
    address: socket.remoteAddress,
    port: socket.remotePort,
  });
  showUsersLogged();

  socket.on("data", async (data) => {
    console.log(
      "mensagem de " +
        socket.remoteAddress +
        ":" +
        socket.remotePort +
        " = " +
        data
    );

    let message;
    let json = null;

    try {
      json = JSON.parse(data);
      if (typeof json !== "object") {
        throw "TBD";
      } else {
        message = await treatRequest(json);
        if (message != "") {
          console.log(
            "enviando para " +
              socket.remoteAddress +
              ":" +
              socket.remotePort +
              " = " +
              message
          );
          socket.write(message);
        }
      }
    } catch (e) {}
  });

  socket.on("message", (data) => {
    socket.write("a");
  });

  socket.on("error", (error) => {});

  socket.on("close", (stream) => {
    console.log(
      "\x1b[31m",
      "\n -> usuário " +
        socket.remoteAddress +
        ":" +
        socket.remotePort +
        " se desconectou"
    );
    usersLoggedOn = usersLoggedOn.filter((user) => {
      return !(
        user.address === socket.remoteAddress && user.port === socket.remotePort
      );
    });
    showUsersLogged();
    //client.close();
  });
});

function showUsersLogged() {
  console.log(
    "\x1b[36m%s\x1b[0m",
    "\n************* Usuários Logados ************\n"
  );
  usersLoggedOn.forEach((user) => {
    console.log("\x1b[32m%s\x1b[0m", "-> " + user.address + ":" + user.port);
  });
  console.log(
    "\x1b[36m%s\x1b[0m",
    "\n*******************************************\n"
  );
}
function treatRequest(json) {
  const protocol = json.protocol;
  switch (protocol) {
    case 100:
      return treatLogin(json);
    case 199:
      return treatLogout();
    case 700:
      return treatCadastro(json);
    case 710:
      return treatUpdateRequest(json);
    case 720:
      return treatUpdate(json);
    default:
      break;
  }
}

function treatLogout() {
  console.log("Usuário requisitou o logout!");
  return "";
}

async function treatCadastro(json) {
  // validando campos
  let reason = "";
  let errorMessages = [];
  if (json.message.username == "") {
    errorMessages.push("Username must not be empty");
  }
  if (json.message.name == "") {
    errorMessages.push("Name must not be empty");
  }
  if (json.message.password == "") {
    errorMessages.push("Password must not be empty");
  }
  if (json.message.password.length > 8) {
    errorMessages.push("Password must have 8 letters at max");
  }
  if (json.message.city == "") {
    errorMessages.push("City must not be empty");
  }
  if (json.message.state == "") {
    errorMessages.push("State must not be empty");
  }
  if (json.message.state.length != 2) {
    errorMessages.push("State field is invalid (must be 2 letters)");
  }

  if (errorMessages.length > 0) {
    errorMessages.forEach((message, index) => {
      reason =
        reason + message + (index == errorMessages.length - 1 ? "" : ", ");
    });
    return stringify({
      protocol: 702,
      message: {
        result: false,
        reason,
      },
    });
  }
  //-----------------------------------------------------------------------------------------
  const promise = client
    .db("distribuidos")
    .collection("users")
    .insertOne(json.message);
  await promise.then((res) => {});
  return stringify({ protocol: 701, message: { result: true } });
}

async function treatLogin(json) {
  let validated = false;
  let errorMessages = [];
  let reason = "";

  //validando campos
  if (json.message.username == "") {
    errorMessages.push("username must not be empty");
  }
  if (json.message.password == "") {
    errorMessages.push("password must not be empty");
  }
  if (errorMessages.length > 0) {
    errorMessages.forEach((message, index) => {
      reason =
        reason + message + (index == errorMessages.length - 1 ? "" : ", ");
    });
    return stringify({
      protocol: 102,
      message: {
        result: false,
        reason,
      },
    });
  }
  //-------------------------------------------------------------------------------

  //Buscando usuário no banco e verificando se senha está correta
  const promise = client
    .db("distribuidos")
    .collection("users")
    .findOne({ username: json.message.username });
  await promise.then((res, err) => {
    if (res) {
      if (res.password === json.message.password) {
        validated = true;
      } else {
        reason = "Wrong Password";
      }
    } else {
      reason = "User not found";
    }
  });
  //----------------------------------------------------------------------------
  if (validated) {
    return stringify({
      protocol: 101,
      message: {
        result: true,
      },
    });
  } else {
    return stringify({
      protocol: 102,
      message: {
        result: false,
        reason,
      },
    });
  }
}

async function treatUpdateRequest(json) {
  let reason = "";
  let errorMessages = [];
  let user = null;
  if (json.message.username == "") {
    errorMessages.push("Username must not be empty");
  }

  if (errorMessages.length > 0) {
    errorMessages.forEach((message, index) => {
      reason =
        reason + message + (index == errorMessages.length - 1 ? "" : ", ");
    });
    return stringify({
      protocol: 712,
      message: {
        result: false,
        reason,
      },
    });
  }
  const promise = client
    .db("distribuidos")
    .collection("users")
    .findOne({ username: json.message.username });

  await promise.then((res, err) => {
    if (res) {
      user = { ...res };
      delete user._id;
      user.result = true;
    }
  });
  if (user) {
    userToUpdate = user.username;
    return stringify({
      protocol: 711,
      message: user,
    });
  } else {
    return stringify({
      protocol: 712,
      message: {
        result: false,
        reason: "User not found",
      },
    });
  }
}

async function treatUpdate(json) {
  // validando campos
  let reason = "";
  let errorMessages = [];
  if (json.message.name == "") {
    errorMessages.push("Name must not be empty");
  }
  if (json.message.password == "") {
    errorMessages.push("Password must not be empty");
  }
  if (json.message.city == "") {
    errorMessages.push("City must not be empty");
  }
  if (json.message.state == "") {
    errorMessages.push("State must not be empty");
  }
  if (json.message.state.length != 2) {
    errorMessages.push("State must have 2 letters");
  }

  if (errorMessages.length > 0) {
    errorMessages.forEach((message, index) => {
      reason =
        reason + message + (index == errorMessages.length - 1 ? "" : ", ");
    });
    return stringify({
      protocol: 722,
      message: {
        result: false,
        reason,
      },
    });
  }
  //----------------------------------------------------------------------
  const promise = client
    .db("distribuidos")
    .collection("users")
    .updateOne(
      { username: userToUpdate },
      { $set: { username: userToUpdate, ...json.message } }
    );

  await promise.then((res, err) => {});
  return stringify({
    protocol: 721,
    message: {
      result: true,
    },
  });
}

function stringify(json) {
  return JSON.stringify(json) + "\n";
}
