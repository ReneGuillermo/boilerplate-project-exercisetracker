const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

// Conexión a la base de datos MongoDB
const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Middleware de CORS y archivos estáticos
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//--------------------------------------
// Midlewares de formularios y esquemas
//--------------------------------------

// Middleware para forms
app.use(express.urlencoded({ extended: false }));

// Esquema de Usuario (solo username)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
});
const User = mongoose.model("User", userSchema);

// Esquema de Ejercicio (referencia al usuario, descripción, duración, fecha)
const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: new Date() }, // Almacena como objeto Date
});
const Exercise = mongoose.model("Exercise", exerciseSchema);

//-------------------------------------
// Endpoint para crear un nuevo usuario
//---------------------------------------

// POST /api/users: Crear un nuevo usuario
app.post("/api/users", async (req, res) => {
  const { username } = req.body;

  try {
    const newUser = new User({ username });
    const savedUser = await newUser.save();

    // Devuelve el objeto User con username y _id
    res.json({
      username: savedUser.username,
      _id: savedUser._id,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    // Manejo básico de error (por ejemplo, si el username ya existe)
    res.status(500).json({ error: "Could not create user" });
  }
});

// GET /api/users: Listar todos los usuarios
app.get("/api/users", async (req, res) => {
  try {
    // Buscar todos los usuarios y solo seleccionar username y _id
    const users = await User.find().select("username _id");
    // Devuelve un array de objetos
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Could not fetch users" });
  }
});

// POST /api/users/:_id/exercises: Registrar un nuevo ejercicio
app.post("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  // Validar campos requeridos
  if (!description || !duration) {
    return res
      .status(400)
      .json({ error: "Description and duration are required" });
  }

  // Buscar usuario
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Formatear y validar la fecha
  let exerciseDate = new Date();
  if (date) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    exerciseDate = parsedDate;
  }

  // Crear y guardar el ejercicio
  try {
    const newExercise = new Exercise({
      userId: user._id,
      description,
      duration: parseInt(duration), // Aseguramos que la duración sea un número
      date: exerciseDate,
    });

    const savedExercise = await newExercise.save();

    // Devolver la respuesta en el formato requerido
    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(), // Formato de cadena de fecha
      duration: savedExercise.duration,
      description: savedExercise.description,
    });
  } catch (err) {
    console.error("Error saving exercise:", err);
    res.status(500).json({ error: "Failed to save exercise" });
  }
});

// GET /api/users/:_id/logs: Obtener log con filtros
app.get("/api/users/:_id/logs", async (req, res) => {
  const { from, to, limit } = req.query;
  const userId = req.params._id;

  // Buscar usuario
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Construir el objeto de consulta (query)
  const dateQuery = {};

  if (from) {
    dateQuery.$gte = new Date(from); // Mayor o igual que (>=)
  }
  if (to) {
    dateQuery.$lte = new Date(to); // Menor o igual que (<=)
  }

  // Buscar ejercicios
  let logQuery = Exercise.find({ userId: userId });

  // Aplicar filtro de fecha si existe
  if (from || to) {
    logQuery = logQuery
      .where("date")
      .gte(dateQuery.$gte || 0)
      .lte(dateQuery.$lte || new Date());
  }

  // Aplicar límite
  if (limit) {
    logQuery = logQuery.limit(parseInt(limit));
  }

  // Ejecutar la búsqueda y ordenar por fecha
  let exercises = await logQuery.sort({ date: 1 }).exec();

  // Formatear el log para la respuesta
  const formattedLog = exercises.map((ex) => ({
    description: ex.description,
    duration: ex.duration,
    date: ex.date.toDateString(), // Usamos toDateString como requiere el hint
  }));

  // Devolver la respuesta final
  res.json({
    _id: user._id,
    username: user.username,
    count: formattedLog.length,
    log: formattedLog,
  });
});

const listener = app.listen(process.env.PORT || 5000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
