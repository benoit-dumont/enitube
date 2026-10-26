import { randomUUID } from 'node:crypto';
import { UniqueConstraintError } from '@sequelize/core';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import HttpError from '../class/HttpError.js';
import { env } from '../config/env.js';
import { loginSchema, parseBody, registerSchema } from '../schemas/auth.js';
import UserService from '../services/user.js';
import type { User } from '../models/index.js'; // déjà présent, ne pas toucher
import type { User as SharedUser } from '@enitube/shared';
const BCRYPT_COST = 12;

// Hash factice : on compare toujours un hash, même si l'email n'existe pas,
// pour que le temps de réponse ne révèle pas si le compte existe.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

const toPublicUser = (user: User): SharedUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
});

const signAccessToken = (userId: string): string =>
  jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });

export const register = async (body: unknown) => {
  const { username, email, password } = parseBody(registerSchema, body);

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let user: User;
  try {
    user = await UserService.createOne({ id: randomUUID(), username, email, passwordHash });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new HttpError({
        code: 409,
        errorCode: 'EMAIL_TAKEN',
        message: 'This email is already used',
      });
    }
    throw error;
  }

  return { accessToken: signAccessToken(user.id), user: toPublicUser(user) };
};

export const login = async (body: unknown) => {
  const { email, password } = parseBody(loginSchema, body);

  const user = await UserService.getOne({ email });
  const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !isValid) {
    throw new HttpError({
      code: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  return { accessToken: signAccessToken(user.id), user: toPublicUser(user) };
};

export const getMe = async (userId: string) => {
  const user = await UserService.getOne({ id: userId });
  if (!user) {
    throw new HttpError({
      code: 401,
      errorCode: 'UNAUTHORIZED',
      message: "This user doesn't exist",
    });
  }
  return { user: toPublicUser(user) };
};
