import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint' })
  telegram_id: number;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ default: false })
  is_blocked: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  last_active_at: Date;
}
