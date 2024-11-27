import bcrypt from "bcrypt";
import User from "../../model/user.model";
import {
  checkExistingUser,
  createUser,
  getUserWithCredentials,
} from "../../service/user.service";
import IUser from "../../interface/user.interface";

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("../../model/user.model", () => {
  return {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null), // Valeur par défaut pour exec
    }),
    create: jest.fn(), // Ajoute un mock pour `create`
  };
});

describe("Test user service", () => {
  const password = "plainPassword";

  let mockUser: any;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash(password, 10);
    mockUser = {
      username: "john_doe",
      email: "john@example.com",
      phonenumber: "1234567890",
      password: hashedPassword,
    };

    // Prépare User.findOne pour retourner un utilisateur lors de tests
    (User.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockUser), // Change pour retourner mockUser
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Get user with credentials", () => {
    it("Should return a user if exists", async () => {
      jest.spyOn(bcrypt, "compare" as any).mockResolvedValue(true);

      const credentials = {
        emailOrPhone: "john@example.com",
        password: "plainPassword",
      };

      const user = await getUserWithCredentials(credentials);
      expect(user).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { email: credentials.emailOrPhone },
          { phonenumber: credentials.emailOrPhone },
        ],
      });
    });

    it("should return null if the user does not exist", async () => {
      (User.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // Aucun utilisateur trouvé
      });

      const credentials = {
        emailOrPhone: "nonexistent@example.com",
        password: "plainPassword",
      };

      const user = await getUserWithCredentials(credentials);
      expect(user).toBeNull(); // Doit retourner null
    });

    it("should return null if the password is incorrect", async () => {
      (User.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // Aucun utilisateur trouvé
      });
      jest.spyOn(bcrypt, "compare" as any).mockResolvedValue(false); // Mot de passe incorrect

      const credentials = {
        emailOrPhone: "john@example.com",
        password: "wrongPassword",
      };

      const user = await getUserWithCredentials(credentials);
      expect(user).toBeNull(); // Doit retourner null
    });
  });

  describe("createUser", () => {
    it("should create and return a new user", async () => {
      (User.create as jest.Mock).mockResolvedValueOnce(mockUser); // Moque correctement `create`
      const createdUser = await createUser(mockUser as IUser);
      expect(createdUser).toEqual(mockUser);
    });

    it("should throw an error if there is an issue with saving", async () => {
      (User.create as jest.Mock).mockRejectedValueOnce(
        new Error("Save failed")
      );

      await expect(createUser(mockUser as IUser)).rejects.toThrow(
        "Save failed"
      );
    });
  });

  describe("checkExistingUser", () => {
    it("should return the user if they exist", async () => {
      (User.findOne as jest.Mock).mockResolvedValueOnce(mockUser);

      const existingUser = await checkExistingUser(mockUser as IUser);
      expect(existingUser).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalled(); // Vérifie que findOne a été appelé
    });

    it("should return null if the user does not exist", async () => {
      (User.findOne as jest.Mock).mockResolvedValueOnce(null);

      const existingUser = await checkExistingUser(mockUser as IUser);
      expect(existingUser).toBeNull(); // Doit retourner null
    });

    it("should throw an error if there is an issue with finding the user", async () => {
      (User.findOne as jest.Mock).mockRejectedValueOnce(
        new Error("Find failed")
      );

      await expect(checkExistingUser(mockUser as IUser)).rejects.toThrow(
        "Find failed"
      );
    });
  });
});
