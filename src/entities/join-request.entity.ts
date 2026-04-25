import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('join_requests')
@Unique(['user_id', 'channel_id'])
export class JoinRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  user_id: number;

  @Column()
  channel_id: string;

  @CreateDateColumn()
  created_at: Date;
}
