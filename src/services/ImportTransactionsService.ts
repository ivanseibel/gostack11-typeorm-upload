import csvParse from 'csv-parse';
import { join } from 'path';
import fs from 'fs';
import { getCustomRepository } from 'typeorm';
import multerConfig from '../config/uploads';
import CreateTransactionService from './CreateTransactionService';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

interface BalanceCSV {
  income: number;
  outcome: number;
  total: number;
}

interface TransactionCSVDTO {
  transactions: TransactionCSV[];
  balance: BalanceCSV;
}

class ImportTransactionsService {
  private async loadCSV(csvFilePath: string): Promise<TransactionCSVDTO> {
    const readCSVStream = fs.createReadStream(csvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);
    const transactions: TransactionCSV[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;
      const transaction = { category, title, type, value };
      transactions.push(transaction);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const balance = transactions.reduce(
      (accumulator: BalanceCSV, { type, value }) => {
        if (type === 'income') {
          accumulator.income = +value;
        }
        if (type === 'outcome') {
          accumulator.outcome = +value;
        }
        return accumulator;
      },
      {
        income: 0,
        outcome: 0,
        total: 0,
      },
    );

    balance.total = balance.income - balance.outcome;

    return { transactions, balance };
  }

  async execute(fileName: string): Promise<Transaction[]> {
    const { tmpDir } = multerConfig;
    const csvFilePath = join(tmpDir, fileName);

    const transactionsCSV: TransactionCSVDTO = await this.loadCSV(csvFilePath);

    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const actualBalance = await transactionsRepository.getBalance();
    const csvBalance = transactionsCSV.balance;

    if (actualBalance.total + csvBalance.total < 0) {
      throw new AppError(
        'The balance of the csv file exceeds the available balance.',
      );
    }

    const createTransactionService = new CreateTransactionService();

    const transactions: Transaction[] = [];

    transactionsCSV.transactions.forEach(async transaction => {
      const newTransaction = await createTransactionService.execute({
        category: transaction.category,
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
      });

      transactions.push(newTransaction);
    });

    return transactions;
  }
}

export default ImportTransactionsService;
