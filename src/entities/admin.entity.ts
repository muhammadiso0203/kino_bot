import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('admins')
export class AdminEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint' })
  telegram_id: number;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true, type: 'bigint' })
  added_by: number;

  @Column({ default: false })
  is_super: boolean;

  @CreateDateColumn()
  created_at: Date;
}
