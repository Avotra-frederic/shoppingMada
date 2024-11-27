import app from "../../config/app";
import { createUser, checkExistingUser, getUserWithCredentials } from "../../service/user.service";
import { findUserGroupId } from "../../service/user_group.service";
import { add_user_in_user_group } from "../../service/user_group_member.service";
import request from "supertest";

jest.mock("../../service/user.service.ts", () => ({
    createUser: jest.fn(),
    checkExistingUser: jest.fn(),
    getUserWithCredentials: jest.fn(),
}));

jest.mock("../../service/user_group.service.ts", () => ({
    findUserGroupId: jest.fn(),
}));

jest.mock("../../service/user_group_member.service.ts", () => ({
    add_user_in_user_group: jest.fn(),
}));

describe("Users Routes", () => {
    describe("register /POST", () => {
        it("should return 201 and create users", async () => {
            const mockuser = {
                username: "JohnDoe",
                phonenumber: "+261381234567",
                email: "johndoe@gmail.com",
                password: "StrongPass1!",
            };

            (checkExistingUser as jest.Mock).mockResolvedValue(false); // Aucune utilisateur existant
            (createUser as jest.Mock).mockResolvedValue(mockuser); // Utilisateur créé
            (findUserGroupId as jest.Mock).mockResolvedValue({ _id: "mockGroupId" }); // Mock du groupe d'utilisateurs
            (add_user_in_user_group as jest.Mock).mockResolvedValue(undefined); // Aucune erreur lors de l'ajout au groupe

            const res = await request(app)
                .post("/api/v1/auth/register")
                .send(mockuser)
                .expect(201);

            expect(res.body.message).toBe("User created successfully!");
            expect(add_user_in_user_group).toHaveBeenCalled(); // Vérifiez que l'ajout a été appelé
        });
    });
});
