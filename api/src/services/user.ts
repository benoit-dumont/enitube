import { Service } from './index.js';
import { User } from '../models/index.js';

export const UserService = new Service(User);
export default UserService;
