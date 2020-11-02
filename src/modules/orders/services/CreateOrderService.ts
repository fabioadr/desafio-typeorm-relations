import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerAlreadyExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!customerAlreadyExists) {
      throw new AppError(`Customer '${customer_id}' does not exists!`);
    }

    const existingProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existingProducts.length) {
      throw new AppError(`Could not find the products with IDs '${products}'!`);
    }

    const existingProductIds = existingProducts.map(product => product.id);

    const checkExistingProductIds = products.filter(
      product => !existingProductIds.includes(product.id),
    );

    if (checkExistingProductIds.length) {
      throw new AppError(
        `Could not find product '${checkExistingProductIds[0].id}'!`,
      );
    }

    const findProductsUnavaiableQuatities = products.filter(
      product =>
        existingProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsUnavaiableQuatities.length) {
      throw new AppError(
        `Quantity '${findProductsUnavaiableQuatities[0].quantity}' for ID '${findProductsUnavaiableQuatities[0].id}'!`,
      );
    }

    const productsDto = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existingProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerAlreadyExists,
      products: productsDto,
    });

    const { order_products } = order;

    const orderedProductsQuantities = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existingProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantities);

    return order;
  }
}

export default CreateOrderService;
