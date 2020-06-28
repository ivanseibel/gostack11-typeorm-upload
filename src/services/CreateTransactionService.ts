// import AppError from '../errors/AppError';

import { getRepository, getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    if (!['income', 'outcome'].includes(type)) {
      throw new AppError('Type must be income or outcome');
    }

    const transactionsRepository = getCustomRepository(TransactionsRepository);

    if (type === 'outcome') {
      const balance = await transactionsRepository.getBalance();
      if (balance.total - value < 0) {
        throw new AppError(
          `Invalid transaction. Actual balance: ${balance.total}`,
        );
      }
    }

    const categoriesRepository = getRepository(Category);

    let getCategory = await categoriesRepository.findOne({
      where: { title: category },
    });

    if (!getCategory) {
      getCategory = categoriesRepository.create({
        title: category,
      });

      await categoriesRepository.save(getCategory);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: getCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
