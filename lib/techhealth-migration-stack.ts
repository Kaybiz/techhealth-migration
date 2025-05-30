import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';

export class TechhealthMigrationStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 2 AZs, 1 public and 1 private subnet per AZ
    const vpc = new ec2.Vpc(this, 'TechhealthMigrationVPC', {
      maxAzs : 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
       { 
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        ],
    });

      // Security Group for EC2 (Allow SSH & App Traffic)
      const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
        vpc,
        allowAllOutbound:true,
        description: 'EC2 Security Group for EC2 instance',
      });
      ec2SecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSSH');
      ec2SecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    
      // Security Group for RDS (Allow Traffic from EC2)
    
      const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
        vpc,
        allowAllOutbound:true,
        description: 'Security Group for RDS instance',
      });
      rdsSecurityGroup.addIngressRule(ec2SecurityGroup, ec2.Port.tcp(3306), 'Allow MySQL from EC2');

      // IAM Role for EC2 Instance
      const ec2Role = new iam.Role(this, 'EC2IAMRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      });
      ec2Role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

      // Launch EC2 Instance in a Public Subnet
      const ec2Instance = new ec2.Instance(this, 'TechhealthMigrationEC2',{
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        machineImage: ec2.MachineImage.latestAmazonLinux2(),
        securityGroup: ec2SecurityGroup,
        role: ec2Role,
      });

      // RDS Instance in Private Subnet
      new rds.DatabaseInstance(this, 'TechhealthMigrationRDS', {
        engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        securityGroups: [rdsSecurityGroup],
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
        allocatedStorage: 20,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // WARNING: Deletes DB on stack removal
      });
  }
}
