import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto = { email: 'test@example.com', password: 'Password123' };
      const result = { id: '1', ...dto, role: 'MEMBRE', isActive: true };
      mockUsersService.create.mockResolvedValue(result);

      expect(await controller.create(dto)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      mockUsersService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({ page: 1, limit: 10 })).toEqual(result);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      const result = { id: '1', email: 'test@example.com' };
      mockUsersService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toEqual(result);
    });
  });
});
