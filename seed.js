const bcrypt = require('bcryptjs');
const { User, Election, Candidate, sequelize } = require('./models');

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const [admin, adminCreated] = await User.findOrCreate({
            where: { email: 'admin@votesecure.com' },
            defaults: {
                name: 'Admin User',
                email: 'admin@votesecure.com',
                password_hash: adminPassword,
                role: 'admin',
                is_verified: true,
                phone: '+1234567890'
            }
        });
        console.log(adminCreated ? '✅ Admin user created' : 'ℹ️  Admin user already exists');

        // Create sample voters
        const voterPassword = await bcrypt.hash('voter123', 10);
        const [voter1, voter1Created] = await User.findOrCreate({
            where: { email: 'john.doe@email.com' },
            defaults: {
                name: 'John Doe',
                email: 'john.doe@email.com',
                password_hash: voterPassword,
                role: 'voter',
                is_verified: true,
                phone: '+1234567891'
            }
        });
        console.log(voter1Created ? '✅ Voter 1 created' : 'ℹ️  Voter 1 already exists');

        // Create active election 1
        const [election1, election1Created] = await Election.findOrCreate({
            where: { title: '2024 City Council Election' },
            defaults: {
                title: '2024 City Council Election',
                description: 'Elect representatives for the city council to serve a 4-year term.',
                start_time: new Date('2024-01-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        console.log(election1Created ? '✅ Election 1 created' : 'ℹ️  Election 1 already exists');

        if (election1Created) {
            await Candidate.bulkCreate([
                {
                    name: 'Sarah Johnson',
                    party: 'Democratic Party',
                    manifesto: 'Focus on education and infrastructure development',
                    image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
                    election_id: election1.id
                },
                {
                    name: 'Mike Davis',
                    party: 'Republican Party',
                    manifesto: 'Economic growth and job creation',
                    image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                    election_id: election1.id
                },
                {
                    name: 'Emily Chen',
                    party: 'Independent',
                    manifesto: 'Environmental sustainability and green initiatives',
                    image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
                    election_id: election1.id
                },
                {
                    name: 'Robert Williams',
                    party: 'Green Party',
                    manifesto: 'Community engagement and social programs',
                    image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
                    election_id: election1.id
                }
            ]);
            console.log('✅ Candidates for Election 1 created');
        }

        // Create active election 2
        const [election2, election2Created] = await Election.findOrCreate({
            where: { title: 'School Board Election 2024' },
            defaults: {
                title: 'School Board Election 2024',
                description: 'Choose board members to oversee educational policies and budget allocation.',
                start_time: new Date('2024-03-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        console.log(election2Created ? '✅ Election 2 created' : 'ℹ️  Election 2 already exists');

        if (election2Created) {
            await Candidate.bulkCreate([
                {
                    name: 'Dr. Amanda Martinez',
                    party: 'Education First',
                    manifesto: 'Increase teacher salaries and modernize curriculum',
                    image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
                    election_id: election2.id
                },
                {
                    name: 'James Thompson',
                    party: 'Parents Coalition',
                    manifesto: 'Focus on STEM education and extracurricular activities',
                    image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
                    election_id: election2.id
                },
                {
                    name: 'Lisa Anderson',
                    party: 'Independent',
                    manifesto: 'Mental health support and inclusive education',
                    image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
                    election_id: election2.id
                }
            ]);
            console.log('✅ Candidates for Election 2 created');
        }

        // Create upcoming election
        const [election3, election3Created] = await Election.findOrCreate({
            where: { title: 'Community Budget Referendum' },
            defaults: {
                title: 'Community Budget Referendum',
                description: 'Vote on the proposed $2.5M budget allocation for community development projects.',
                start_time: new Date('2027-01-01'),
                end_time: new Date('2027-01-31'),
                status: 'upcoming',
                created_by: admin.id
            }
        });
        console.log(election3Created ? '✅ Election 3 created' : 'ℹ️  Election 3 already exists');

        if (election3Created) {
            await Candidate.bulkCreate([
                {
                    name: 'YES - Approve Budget',
                    party: 'Proposal',
                    manifesto: 'Support infrastructure improvements and community programs',
                    image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
                    election_id: election3.id
                },
                {
                    name: 'NO - Reject Budget',
                    party: 'Opposition',
                    manifesto: 'Reduce spending and lower taxes',
                    image_url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85',
                    election_id: election3.id
                }
            ]);
            console.log('✅ Candidates for Election 3 created');
        }

        // Create ended election
        const [election4, election4Created] = await Election.findOrCreate({
            where: { title: 'Mayor Election 2024' },
            defaults: {
                title: 'Mayor Election 2024',
                description: 'Elected the city mayor for the 2024-2028 term.',
                start_time: new Date('2024-01-01'),
                end_time: new Date('2024-08-31'),
                status: 'ended',
                created_by: admin.id
            }
        });
        console.log(election4Created ? '✅ Election 4 created' : 'ℹ️  Election 4 already exists');

        if (election4Created) {
            await Candidate.bulkCreate([
                {
                    name: 'Sarah Johnson',
                    party: 'Democratic Party',
                    manifesto: 'Progressive policies for city development',
                    image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
                    election_id: election4.id
                },
                {
                    name: 'Mike Davis',
                    party: 'Republican Party',
                    manifesto: 'Conservative fiscal management',
                    image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                    election_id: election4.id
                }
            ]);
            console.log('✅ Candidates for Election 4 created');
        }

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📝 Login credentials:');
        console.log('   Admin: admin@votesecure.com / admin123');
        console.log('   Voter: john.doe@email.com / voter123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

seedDatabase();
